import type { Job } from 'bullmq';
import { prisma } from '@ai-coach/db';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
import { morningReportPrompt } from '@ai-coach/ai';
import webpush from 'web-push';

interface MorningReportJobData {
  userId?: string;
  date?: string; // ISO date, defaults to today
  triggerAllUsers?: boolean;
}

function setupWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey);
    return true;
  }
  return false;
}

export async function morningReportJob(job: Job<MorningReportJobData>): Promise<void> {
  const { userId, date, triggerAllUsers } = job.data;

  // Cron dispatch: find all users and process each
  if (triggerAllUsers) {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      try {
        await morningReportJob({ ...job, data: { userId: u.id, date } } as Job<MorningReportJobData>);
      } catch (err) {
        console.error(`[morning-report] Error for user ${u.id}:`, err);
      }
    }
    return;
  }

  if (!userId) return;

  console.log(`[morning-report] Generating report for user ${userId}`);

  const todayStr = date ?? new Date().toISOString().split('T')[0]!;
  const today = new Date(todayStr);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [healthMetric, planData, calendarData, injuriesData, eventsData, yesterdayActivity] =
    await Promise.allSettled([
      prisma.healthMetric.findFirst({ where: { userId, date: { gte: today, lt: tomorrow } } }),
      prisma.trainingPlan.findFirst({
        where: { userId, weekStart: { lte: today }, status: { in: ['ACTIVE', 'DRAFT'] } },
        orderBy: { weekStart: 'desc' },
      }),
      prisma.calendarEvent.findMany({
        where: { userId, startTime: { gte: today }, endTime: { lt: tomorrow } },
        orderBy: { startTime: 'asc' },
      }),
      prisma.injury.findMany({ where: { userId, active: true } }),
      prisma.event.findMany({
        where: { userId, date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 3,
      }),
      prisma.activity.findFirst({
        where: { userId, date: { gte: yesterday, lt: today } },
        orderBy: { date: 'desc' },
      }),
    ]);

  const health = healthMetric.status === 'fulfilled' ? healthMetric.value : null;
  const plan = planData.status === 'fulfilled' ? planData.value : null;
  const calendar = calendarData.status === 'fulfilled' ? calendarData.value : [];
  const injuries = injuriesData.status === 'fulfilled' ? injuriesData.value : [];
  const events = eventsData.status === 'fulfilled' ? eventsData.value : [];
  const yesterdayAct = yesterdayActivity.status === 'fulfilled' ? yesterdayActivity.value : null;

  const promptText = morningReportPrompt({
    health: health
      ? {
          sleepScore: health.sleepScore,
          sleepDuration: health.sleepDuration,
          bodyBattery: health.bodyBattery,
          hrvStatus: health.hrvStatus,
          hrvBaseline: health.hrvBaseline,
          trainingReadiness: health.trainingReadiness,
          restingHR: health.restingHR,
        }
      : null,
    plan: plan ? { plan: plan.plan } : null,
    calendar: calendar.map(e => ({
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      category: e.category,
    })),
    injuries: injuries.map(i => ({
      bodyPart: i.bodyPart,
      severity: i.severity,
      description: i.description,
    })),
    events: events.map(e => ({
      name: e.name,
      date: e.date,
      daysUntil: Math.ceil((e.date.getTime() - Date.now()) / 86400000),
    })),
    yesterday: yesterdayAct
      ? {
          sport: yesterdayAct.sport,
          duration: yesterdayAct.duration,
          distance: yesterdayAct.distance,
          name: yesterdayAct.name,
        }
      : null,
  });

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: promptText,
  });

  const metricsUsed = {
    hasHealth: !!health,
    hasPlan: !!plan,
    calendarCount: calendar.length,
    injuryCount: injuries.length,
    eventCount: events.length,
    hasYesterdayActivity: !!yesterdayAct,
  };

  await prisma.dailyReport.upsert({
    where: { userId_date: { userId, date: today } },
    update: { report: metricsUsed, markdown: text, metricsUsed, aiModel: 'gemini-2.5-flash' },
    create: { userId, date: today, report: metricsUsed, markdown: text, metricsUsed, aiModel: 'gemini-2.5-flash' },
  });

  console.log(`[morning-report] Report saved for user ${userId}`);

  // Send push notification if user has a subscription
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushSubscription: true },
    });

    if (user?.pushSubscription && setupWebPush()) {
      const sub = user.pushSubscription as { endpoint: string; keys: { p256dh: string; auth: string } };

      // Extract first 2 lines for notification body
      const firstLines = text.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').slice(0, 100);

      await webpush.sendNotification(
        sub,
        JSON.stringify({
          title: '🌅 Ranní briefing',
          body: firstLines,
          url: '/',
          icon: '/icons/icon-192.png',
        }),
      );

      console.log(`[morning-report] Push notification sent for user ${userId}`);
    }
  } catch (err) {
    console.error('[morning-report] Push notification error:', err);
  }

  await job.updateProgress(100);
  console.log(`[morning-report] Completed for user ${userId}`);
}
