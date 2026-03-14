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
  // Garmin sync — every 2 hours
  await queues.garminSync.add(
    'scheduled-all',
    { triggerAllUsers: true },
    { repeat: { pattern: '0 */2 * * *' }, jobId: 'garmin-sync-cron' },
  );

  // Strava sync — every 3 hours
  await queues.stravaSync.add(
    'scheduled-all',
    { triggerAllUsers: true },
    { repeat: { pattern: '0 */3 * * *' }, jobId: 'strava-sync-cron' },
  );

  // Calendar sync — every hour
  await queues.calendarSync.add(
    'scheduled-all',
    { triggerAllUsers: true },
    { repeat: { pattern: '0 * * * *' }, jobId: 'calendar-sync-cron' },
  );

  console.log('[schedules] All cron schedules registered');
}
