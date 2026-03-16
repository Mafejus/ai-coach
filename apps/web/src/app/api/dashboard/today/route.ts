import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { toISODate } from '@ai-coach/shared';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [todayMetrics, weekMetrics, todayCalendar, todayPlan, recentActivities, upcomingEvents] =
    await Promise.allSettled([
      prisma.healthMetric.findFirst({
        where: { userId, date: { gte: today, lt: tomorrow } },
      }),
      prisma.healthMetric.findMany({
        where: { userId, date: { gte: sevenDaysAgo, lt: tomorrow } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          bodyBattery: true,
          hrvStatus: true,
          hrvBaseline: true,
          sleepScore: true,
          sleepDuration: true,
          trainingReadiness: true,
          restingHR: true,
        },
      }),
      prisma.calendarEvent.findMany({
        where: { userId, startTime: { gte: today }, endTime: { lte: tomorrow } },
        orderBy: { startTime: 'asc' },
      }),
      prisma.trainingPlan.findFirst({
        where: {
          userId,
          weekStart: { lte: today },
          status: { in: ['ACTIVE', 'DRAFT'] },
        },
        orderBy: { weekStart: 'desc' },
      }),
      prisma.activity.findMany({
        where: { userId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'desc' },
        take: 5,
        select: { id: true, sport: true, name: true, date: true, duration: true, distance: true, avgHR: true, avgPace: true },
      }),
      prisma.event.findMany({
        where: { userId, date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 3,
      }),
    ]);

  return NextResponse.json({
    today: todayMetrics.status === 'fulfilled' ? todayMetrics.value : null,
    weekMetrics: weekMetrics.status === 'fulfilled' ? weekMetrics.value : [],
    calendar: todayCalendar.status === 'fulfilled' ? todayCalendar.value : [],
    plan: todayPlan.status === 'fulfilled' ? todayPlan.value : null,
    recentActivities: recentActivities.status === 'fulfilled' ? recentActivities.value : [],
    upcomingEvents: upcomingEvents.status === 'fulfilled'
      ? upcomingEvents.value.map(e => ({
          ...e,
          daysUntil: Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000),
        }))
      : [],
  });
}
