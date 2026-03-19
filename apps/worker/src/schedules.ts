import type { Queue } from 'bullmq';
import { prisma } from '@ai-coach/db';

interface Queues {
  garminSync: Queue;
  stravaSync: Queue;
  calendarSync: Queue;
  morningReport: Queue;
  weeklyPlan: Queue;
}

async function getAllUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({ select: { id: true } });
  return users.map((u) => u.id);
}

export async function setupSchedules(queues: Queues): Promise<void> {
  // Garmin quick sync — every 4 hours (today's data only)
  await queues.garminSync.add(
    'scheduled-all',
    { triggerAllUsers: true, mode: 'quick' },
    { repeat: { pattern: '0 */4 * * *' }, jobId: 'garmin-quick-sync-cron' },
  );

  // Garmin full sync — every 6 hours (last 14 days)
  await queues.garminSync.add(
    'scheduled-all',
    { triggerAllUsers: true, mode: 'full' },
    { repeat: { pattern: '0 */6 * * *' }, jobId: 'garmin-full-sync-cron' },
  );

  // Strava sync — every 30 minutes (rate-limited)
  await queues.stravaSync.add(
    'scheduled-all',
    { triggerAllUsers: true },
    { repeat: { pattern: '*/30 * * * *' }, jobId: 'strava-sync-cron' },
  );

  // Calendar sync — every 15 minutes
  await queues.calendarSync.add(
    'scheduled-all',
    { triggerAllUsers: true },
    { repeat: { pattern: '*/15 * * * *' }, jobId: 'calendar-sync-cron' },
  );

  // Morning report — every day at 6:00 AM
  // We enqueue one job per user at 6:00
  await queues.morningReport.add(
    'morning-report-cron',
    { triggerAllUsers: true },
    { repeat: { pattern: '0 6 * * *' }, jobId: 'morning-report-cron' },
  );

  // Weekly plan — every Sunday at 20:00
  await queues.weeklyPlan.add(
    'weekly-plan-cron',
    { triggerAllUsers: true },
    { repeat: { pattern: '0 20 * * 0' }, jobId: 'weekly-plan-cron' },
  );

  console.log('[schedules] All cron schedules registered');
}
