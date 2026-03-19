import type { Job } from 'bullmq';
import { prisma } from '@ai-coach/db';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { morningReportPrompt } from '@ai-coach/ai';
import webpush from 'web-push';

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

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

  const [healthMetric, coachContext, plannedWorkouts, calendarData, injuriesData, eventsData, recentActivities] =
    await Promise.allSettled([
      prisma.healthMetric.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.activeCoachContext.findUnique({ where: { userId } }),
      prisma.plannedWorkout.findMany({
        where: { userId, date: { gte: today, lte: tomorrow } },
        orderBy: { date: 'asc' },
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
      prisma.activity.findMany({
        where: { userId, date: { gte: new Date(Date.now() - 7 * 86400000) } },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

  const health = healthMetric.status === 'fulfilled' ? healthMetric.value : null;
  const context = coachContext.status === 'fulfilled' ? coachContext.value : null;
  const pWorkouts = plannedWorkouts.status === 'fulfilled' ? plannedWorkouts.value : [];
  const calendar = calendarData.status === 'fulfilled' ? calendarData.value : [];
  const injuries = injuriesData.status === 'fulfilled' ? injuriesData.value : [];
  const events = eventsData.status === 'fulfilled' ? eventsData.value : [];
  const activities = recentActivities.status === 'fulfilled' ? recentActivities.value : [];

  const promptText = morningReportPrompt({
    health: health
      ? {
          date: health.date.toISOString().split('T')[0],
          sleepScore: health.sleepScore,
          sleepDuration: health.sleepDuration,
          bodyBattery: health.bodyBattery,
          bodyBatteryChange: health.bodyBatteryChange,
          hrvStatus: health.hrvStatus,
          hrvBaseline: health.hrvBaseline,
          trainingReadiness: health.trainingReadiness,
          restingHR: health.restingHR,
        }
      : null,
    coachContext: context
      ? {
          directives: context.coachDirectives,
          focusAreas: context.focusAreas,
          recoveryStatus: context.recoveryStatus,
          overtrainingRisk: context.overtrainingRisk,
        }
      : null,
    plannedWorkouts: pWorkouts.map(w => ({
      date: w.date.toLocaleDateString('cs-CZ'),
      title: w.title || 'Trénink',
      type: w.workoutType || 'OTHER',
      duration: w.durationMinutes || 0,
      description: w.description || '',
      isRestDay: w.isRestDay,
    })),
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
    history: activities.map(a => ({
      date: a.date?.toISOString()?.split('T')[0] ?? '',
      sport: a.sport,
      duration: a.duration,
      distance: a.distance,
      name: a.name,
      trainingLoad: a.trainingLoad,
      aerobicTE: (a.rawData as any)?.aerobicTrainingEffect,
      anaerobicTE: (a.rawData as any)?.anaerobicTrainingEffect,
    })),
  });

  const { text } = await generateText({
    model: google('gemini-2.5-pro'),
    prompt: promptText,
  });

  const metricsUsed = {
    hasHealth: !!health,
    hasContext: !!context,
    plannedWorkouts: pWorkouts.length,
    calendarCount: calendar.length,
    injuryCount: injuries.length,
    eventCount: events.length,
    hasActivities: activities.length > 0,
  };

  await prisma.dailyReport.upsert({
    where: { userId_date: { userId, date: today } },
    update: { report: metricsUsed, markdown: text, metricsUsed, aiModel: 'gemini-2.5-pro' },
    create: { userId, date: today, report: metricsUsed, markdown: text, metricsUsed, aiModel: 'gemini-2.5-pro' },
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
