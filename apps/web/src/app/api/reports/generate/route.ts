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
  const [
    healthMetric, 
    coachContext,
    plannedWorkouts,
    calendarData, 
    injuriesData, 
    eventsData, 
    recentActivities
  ] = await Promise.allSettled([
    prisma.healthMetric.findFirst({ 
      where: { userId }, 
      orderBy: { date: 'desc' } 
    }),
    prisma.activeCoachContext.findUnique({
      where: { userId }
    }),
    prisma.plannedWorkout.findMany({
      where: { userId, date: { gte: today, lte: tomorrow } },
      orderBy: { date: 'asc' }
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
    coachContext: context ? {
      directives: context.coachDirectives,
      focusAreas: context.focusAreas,
      recoveryStatus: context.recoveryStatus,
      overtrainingRisk: context.overtrainingRisk,
    } : null,
    plannedWorkouts: pWorkouts.map(w => ({
      date: w.date.toLocaleDateString('cs-CZ'),
      title: w.title || 'Trénink',
      type: w.workoutType || 'OTHER',
      duration: w.durationMinutes || 0,
      description: w.description || '',
      isRestDay: w.isRestDay,
    })),
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

  const report = await prisma.dailyReport.upsert({
    where: { userId_date: { userId, date: today } },
    update: { report: metricsUsed as any, markdown: text, metricsUsed: metricsUsed as any, aiModel: 'gemini-2.5-pro' },
    create: { userId, date: today, report: metricsUsed as any, markdown: text, metricsUsed: metricsUsed as any, aiModel: 'gemini-2.5-pro' },
  });

  return NextResponse.json(report);
}
