import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
import { morningReportPrompt } from '@ai-coach/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Gather all data
  const [healthMetric, planData, calendarData, injuriesData, eventsData, recentActivities] =
    await Promise.allSettled([
      // Try today first, then fallback to last available in local logic
      prisma.healthMetric.findFirst({ 
        where: { userId }, 
        orderBy: { date: 'desc' } 
      }),
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
      prisma.activity.findMany({
        where: { userId, date: { gte: new Date(Date.now() - 7 * 86400000) } },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);
 
  const health = healthMetric.status === 'fulfilled' ? healthMetric.value : null;
  const plan = planData.status === 'fulfilled' ? planData.value : null;
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
    model: google('gemini-2.5-flash'),
    prompt: promptText,
  });

  const metricsUsed = {
    hasHealth: !!health,
    hasPlan: !!plan,
    calendarCount: calendar.length,
    injuryCount: injuries.length,
    eventCount: events.length,
    hasYesterdayActivity: !!yesterday_activity,
  };

  const report = await prisma.dailyReport.upsert({
    where: { userId_date: { userId, date: today } },
    update: { report: metricsUsed, markdown: text, metricsUsed, aiModel: 'gemini-2.5-flash' },
    create: { userId, date: today, report: metricsUsed, markdown: text, metricsUsed, aiModel: 'gemini-2.5-flash' },
  });

  return NextResponse.json(report);
}
