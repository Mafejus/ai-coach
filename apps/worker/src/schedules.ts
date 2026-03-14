import type { Queue } from 'bullmq';

interface Queues {
  garminSync: Queue;
  stravaSync: Queue;
  calendarSync: Queue;
  morningReport: Queue;
  weeklyPlan: Queue;
}

export function setupSchedules(_queues: Queues): void {
  // TODO: Activate in Phase 1/3
  // Schedules use cron expressions

  // Garmin sync - every 2 hours
  // queues.garminSync.add('scheduled', {}, {
  //   repeat: { pattern: '0 */2 * * *' }
  // });

  // Calendar sync - every hour
  // queues.calendarSync.add('scheduled', {}, {
  //   repeat: { pattern: '0 * * * *' }
  // });

  // Morning report - 6:00 AM Prague time (UTC+1/+2)
  // queues.morningReport.add('scheduled', {}, {
  //   repeat: { pattern: '0 5 * * *' }  // 5:00 UTC = 6:00 CET
  // });

  // Weekly plan - Sunday 20:00 Prague time
  // queues.weeklyPlan.add('scheduled', {}, {
  //   repeat: { pattern: '0 19 * * 0' }  // 19:00 UTC = 20:00 CET
  // });

  console.log('[schedules] Schedules registered (currently inactive)');
}
