import type { Job } from 'bullmq';

interface GarminSyncJobData {
  userId: string;
  date?: string; // ISO date, defaults to today
}

export async function garminSyncJob(job: Job<GarminSyncJobData>): Promise<void> {
  const { userId, date } = job.data;
  console.log(`[garmin-sync] Starting sync for user ${userId}, date: ${date ?? 'today'}`);

  // TODO: Phase 1 implementation
  // 1. Load user's Garmin credentials from DB (decrypted)
  // 2. Authenticate with GarminClient
  // 3. Fetch sleep, HR, HRV, body battery, user summary
  // 4. Parse data with parsers from @ai-coach/garmin
  // 5. Upsert into health_metrics table
  // 6. Fetch recent activities
  // 7. Upsert into activities table

  await job.updateProgress(100);
  console.log(`[garmin-sync] Completed for user ${userId}`);
}
