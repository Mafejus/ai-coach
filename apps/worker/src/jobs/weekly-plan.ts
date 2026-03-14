import type { Job } from 'bullmq';

interface WeeklyPlanJobData {
  userId: string;
  weekStart?: string; // ISO date (Monday), defaults to next week
}

export async function weeklyPlanJob(job: Job<WeeklyPlanJobData>): Promise<void> {
  const { userId, weekStart } = job.data;
  console.log(`[weekly-plan] Generating plan for user ${userId}`);

  // TODO: Phase 4 implementation
  // 1. Get user profile + target events
  // 2. Get last week's training summary
  // 3. Get next week's calendar events
  // 4. Get active injuries
  // 5. Generate weekly plan with AI
  // 6. Save to training_plans table
  // 7. Send push notification

  await job.updateProgress(100);
  console.log(`[weekly-plan] Completed for user ${userId}`);
}
