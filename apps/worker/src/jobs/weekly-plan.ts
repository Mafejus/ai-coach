import type { Job } from 'bullmq';
import { prisma, Prisma } from '@ai-coach/db';
import type { PlanStatus } from '@ai-coach/db';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
import { weeklyPlanPrompt } from '@ai-coach/ai';
import { getMonday } from '@ai-coach/shared';

interface WeeklyPlanJobData {
  userId?: string;
  weekStart?: string; // ISO date (Monday), defaults to next week
  triggerAllUsers?: boolean;
}

export async function weeklyPlanJob(job: Job<WeeklyPlanJobData>): Promise<void> {
  const { userId, weekStart, triggerAllUsers } = job.data;

  // Cron dispatch: process all users
  if (triggerAllUsers) {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      try {
        await weeklyPlanJob({ ...job, data: { userId: u.id, weekStart } } as Job<WeeklyPlanJobData>);
      } catch (err) {
        console.error(`[weekly-plan] Error for user ${u.id}:`, err);
      }
    }
    return;
  }

  if (!userId) return;

  console.log(`[weekly-plan] Generating plan for user ${userId}`);

  const today = new Date();
  const targetMonday = weekStart
    ? new Date(weekStart)
    : (() => {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return getMonday(nextWeek);
      })();

  const weekEndDate = new Date(targetMonday);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const [user, recentActivities, upcomingCalendar, injuries, events, recentPlans] =
    await Promise.allSettled([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.activity.findMany({
        where: { userId, date: { gte: fourWeeksAgo } },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      prisma.calendarEvent.findMany({
        where: {
          userId,
          startTime: { gte: targetMonday },
          endTime: { lt: weekEndDate },
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.injury.findMany({ where: { userId, active: true } }),
      prisma.event.findMany({
        where: { userId, date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 5,
      }),
      prisma.trainingPlan.findMany({
        where: { userId },
        orderBy: { weekStart: 'desc' },
        take: 4,
      }),
    ]);

  const userData = user.status === 'fulfilled' ? user.value : null;
  if (!userData) {
    console.error(`[weekly-plan] User ${userId} not found`);
    return;
  }

  const activities = recentActivities.status === 'fulfilled' ? recentActivities.value : [];
  const calendar = upcomingCalendar.status === 'fulfilled' ? upcomingCalendar.value : [];
  const injuriesData = injuries.status === 'fulfilled' ? injuries.value : [];
  const eventsData = events.status === 'fulfilled' ? events.value : [];
  const recentPlanData = recentPlans.status === 'fulfilled' ? recentPlans.value : [];

  // Calculate recent compliance
  const lastPlan = recentPlanData[0];
  const recentCompliance = lastPlan?.compliance ?? null;

  const promptText = weeklyPlanPrompt({
    user: {
      name: userData.name,
      maxHR: userData.maxHR,
      restHR: userData.restHR,
      ftp: userData.ftp,
      thresholdPace: userData.thresholdPace,
      swimCSS: userData.swimCSS,
      weeklyHoursMax: userData.weeklyHoursMax,
    },
    weekStart: targetMonday.toISOString().split('T')[0]!,
    recentActivities: activities.map(a => ({
      sport: a.sport,
      date: a.date,
      duration: a.duration,
      distance: a.distance,
      trainingLoad: a.trainingLoad,
      avgHR: a.avgHR,
    })),
    calendar: calendar.map(e => ({
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      isAllDay: e.isAllDay,
      category: e.category,
    })),
    injuries: injuriesData.map(i => ({
      bodyPart: i.bodyPart,
      severity: i.severity,
      description: i.description,
      restrictions: i.restrictions as Record<string, unknown> | null,
    })),
    events: eventsData.map(e => ({
      name: e.name,
      sport: e.sport,
      date: e.date,
      daysUntil: Math.ceil((e.date.getTime() - Date.now()) / 86400000),
    })),
    recentCompliance,
  });

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: promptText,
  });

  // Parse JSON from response
  let planJson: Record<string, unknown>;
  try {
    // Extract JSON block if wrapped in markdown
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch?.[1] ?? text;
    planJson = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (err) {
    console.error('[weekly-plan] Failed to parse JSON response:', err);
    // Save raw as plan anyway
    planJson = { raw: text, days: [], error: 'Failed to parse structured plan' };
  }

  const totalHours = typeof planJson.totalHours === 'number' ? planJson.totalHours : null;
  const totalTSS = typeof planJson.totalTSS === 'number' ? planJson.totalTSS : null;

  await prisma.trainingPlan.upsert({
    where: { userId_weekStart: { userId, weekStart: targetMonday } },
    update: {
      plan: planJson as Prisma.InputJsonValue,
      status: 'ACTIVE' as PlanStatus,
      plannedHours: totalHours,
      plannedTSS: totalTSS,
      updatedAt: new Date(),
    },
    create: {
      userId,
      weekStart: targetMonday,
      plan: planJson as Prisma.InputJsonValue,
      status: 'ACTIVE' as PlanStatus,
      plannedHours: totalHours,
      plannedTSS: totalTSS,
    },
  });

  console.log(`[weekly-plan] Plan saved for week ${targetMonday.toISOString().split('T')[0]} for user ${userId}`);

  await job.updateProgress(100);
  console.log(`[weekly-plan] Completed for user ${userId}`);
}
