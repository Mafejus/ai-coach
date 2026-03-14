import type { Job } from 'bullmq';
import { prisma, Prisma } from '@ai-coach/db';
import type { Sport } from '@ai-coach/db';
import { StravaClient } from '@ai-coach/strava';
import { parseStravaActivity } from '@ai-coach/strava';

interface StravaSyncJobData {
  userId: string;
  activityId?: number;
  after?: number;
}

export async function stravaSyncJob(job: Job<StravaSyncJobData>): Promise<void> {
  const { userId, activityId, after } = job.data;
  console.log(`[${new Date().toISOString()}] [strava-sync] Starting for user ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stravaTokens: true },
  });

  if (!user?.stravaTokens) {
    console.log(`[strava-sync] No Strava tokens for user ${userId}, skipping`);
    return;
  }

  let tokens = user.stravaTokens as {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    athleteId: number;
  };

  // Refresh tokens if needed
  if (Date.now() >= tokens.expiresAt - 300_000) {
    const refreshed = await StravaClient.refreshTokens(
      process.env.STRAVA_CLIENT_ID!,
      process.env.STRAVA_CLIENT_SECRET!,
      tokens.refreshToken,
    );
    tokens = { ...tokens, ...refreshed };
    await prisma.user.update({
      where: { id: userId },
      data: { stravaTokens: tokens },
    });
  }

  const client = new StravaClient(tokens);

  function toActivityData(parsed: ReturnType<typeof parseStravaActivity>, uid: string) {
    return {
      ...parsed,
      sport: parsed.sport as Sport,
      laps: parsed.laps != null ? (parsed.laps as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      rawData: (parsed.rawData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      userId: uid,
    };
  }

  if (activityId) {
    // Single activity sync (webhook-triggered)
    try {
      const raw = await client.getDetailedActivity(activityId);
      const parsed = parseStravaActivity(raw);
      const data = toActivityData(parsed, userId);
      await prisma.activity.upsert({
        where: { source_externalId: { source: 'STRAVA', externalId: parsed.externalId } },
        update: data,
        create: data,
      });
      console.log(`[strava-sync] Activity ${activityId} synced`);
    } catch (err) {
      console.error(`[strava-sync] Activity ${activityId} error:`, err);
    }
  } else {
    // Bulk sync
    const lastActivity = await prisma.activity.findFirst({
      where: { userId, source: 'STRAVA' },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    const syncAfter = after ??
      (lastActivity
        ? Math.floor(lastActivity.date.getTime() / 1000) - 86400
        : Math.floor((Date.now() - 30 * 86400_000) / 1000));

    const activities = await client.getActivities(syncAfter);
    let count = 0;

    for (const raw of activities) {
      try {
        const parsed = parseStravaActivity(raw);
        const data = toActivityData(parsed, userId);
        await prisma.activity.upsert({
          where: { source_externalId: { source: 'STRAVA', externalId: parsed.externalId } },
          update: data,
          create: data,
        });
        count++;
      } catch (err) {
        console.error('[strava-sync] Activity upsert error:', err);
      }
    }
    console.log(`[strava-sync] ${count} activities synced`);
  }

  await job.updateProgress(100);
  console.log(`[${new Date().toISOString()}] [strava-sync] Completed for user ${userId}`);
}
