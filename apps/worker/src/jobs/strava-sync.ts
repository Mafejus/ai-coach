import type { Job } from 'bullmq';

interface StravaSyncJobData {
  userId: string;
  activityId?: number; // If triggered by webhook
  after?: number; // Unix timestamp for bulk sync
}

export async function stravaSyncJob(job: Job<StravaSyncJobData>): Promise<void> {
  const { userId, activityId, after } = job.data;
  console.log(`[strava-sync] Starting sync for user ${userId}`);

  // TODO: Phase 1 implementation
  // 1. Load user's Strava tokens from DB
  // 2. Refresh tokens if expired
  // 3. If activityId: fetch single activity details
  // 4. If after: fetch all activities since timestamp
  // 5. Parse and upsert into activities table

  await job.updateProgress(100);
  console.log(`[strava-sync] Completed for user ${userId}`);
}
