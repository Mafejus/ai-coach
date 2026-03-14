import type { Job } from 'bullmq';

interface CalendarSyncJobData {
  userId: string;
  daysAhead?: number; // How many days to sync, default 30
}

export async function calendarSyncJob(job: Job<CalendarSyncJobData>): Promise<void> {
  const { userId, daysAhead = 30 } = job.data;
  console.log(`[calendar-sync] Starting sync for user ${userId}, days ahead: ${daysAhead}`);

  // TODO: Phase 1 implementation
  // 1. Load user's Google tokens from DB
  // 2. Refresh tokens if expired
  // 3. Fetch events from primary + school calendar
  // 4. Classify events by category
  // 5. Upsert into calendar_events table

  await job.updateProgress(100);
  console.log(`[calendar-sync] Completed for user ${userId}`);
}
