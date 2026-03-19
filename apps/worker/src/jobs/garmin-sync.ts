import type { Job } from 'bullmq';
import { prisma, Prisma } from '@ai-coach/db';
import type { Sport } from '@ai-coach/db';
import { GarminClient } from '@ai-coach/garmin';
import {
  parseSleepToHealthMetric,
  parseHRToHealthMetric,
  parseHRVToHealthMetric,
  parseUserSummaryToHealthMetric,
  parseTrainingReadiness,
  mergeHealthMetrics,
  parseGarminActivity,
} from '@ai-coach/garmin';
import { toISODate, addDays } from '@ai-coach/shared';

interface GarminSyncJobData {
  userId?: string;
  date?: string;
  mode?: 'quick' | 'full';
  triggerAllUsers?: boolean;
}

async function decryptPassword(encrypted: string): Promise<string> {
  const { createDecipheriv } = await import('crypto');
  const keyHex = process.env.ENCRYPTION_KEY!;
  const key = Buffer.from(keyHex, 'hex');
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext');
  const [ivHex, tagHex, encHex] = parts as [string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

async function syncGarminForUser(userId: string, mode: 'quick' | 'full', date?: string): Promise<void> {
  console.log(`[garmin-sync] Starting for user ${userId} mode=${mode}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { garminEmail: true, garminPassword: true },
  });

  if (!user?.garminEmail || !user.garminPassword) {
    console.log(`[garmin-sync] No Garmin credentials for user ${userId}, skipping`);
    return;
  }

  const password = await decryptPassword(user.garminPassword);
  const client = new GarminClient(user.garminEmail, password);
  await client.authenticate();

  const today = toISODate(new Date());
  const yesterday = toISODate(new Date(Date.now() - 86400_000));

  let dates: string[];
  if (date) {
    dates = [date];
  } else if (mode === 'full') {
    dates = Array.from({ length: 14 }, (_, i) => toISODate(addDays(new Date(), -(i + 1)))).reverse();
    dates.push(today);
  } else {
    dates = [yesterday, today];
  }

  // Sync health metrics — sequential calls to respect Garmin rate limit (2s between requests)
  for (const d of dates) {
    try {
      const parts: Record<string, unknown>[] = [];
      const rawData: Record<string, unknown> = {};

      // 1. Sleep
      try {
        const sleepData = await client.getSleepData(d);
        console.log(`[garmin-sync] Sleep raw for ${d}:`, JSON.stringify(sleepData).substring(0, 500));
        rawData.sleep = sleepData;
        parts.push(parseSleepToHealthMetric(sleepData));
      } catch (e) {
        console.error(`[garmin-sync] Sleep fetch failed for ${d}:`, (e as Error).message);
      }

      // 2. Heart rate
      try {
        const hrData = await client.getHeartRate(d);
        console.log(`[garmin-sync] HR raw for ${d}:`, JSON.stringify(hrData).substring(0, 300));
        rawData.heartRate = hrData;
        parts.push(parseHRToHealthMetric(hrData));
      } catch (e) {
        console.error(`[garmin-sync] HR fetch failed for ${d}:`, (e as Error).message);
      }

      // 3. HRV (via raw endpoint hrv-service/hrv/DATE)
      try {
        const hrvData = await client.getHRVData(d);
        console.log(`[garmin-sync] HRV raw for ${d}:`, JSON.stringify(hrvData).substring(0, 300));
        rawData.hrv = hrvData;
        parts.push(parseHRVToHealthMetric(hrvData));
      } catch (e) {
        console.error(`[garmin-sync] HRV fetch failed for ${d}:`, (e as Error).message);
      }

      // 4. User summary (Body Battery, Stress — via usersummary-service endpoint)
      try {
        const summaryData = await client.getUserSummary(d);
        console.log(`[garmin-sync] Summary raw for ${d}:`, JSON.stringify(summaryData).substring(0, 500));
        rawData.userSummary = summaryData;
        parts.push(parseUserSummaryToHealthMetric(summaryData));
      } catch (e) {
        console.error(`[garmin-sync] Summary fetch failed for ${d}:`, (e as Error).message);
      }

      // 5. Training Readiness (via trainingreadiness-service)
      try {
        const trData = await client.getTrainingReadiness(d);
        if (trData) {
          console.log(`[garmin-sync] TR raw for ${d}:`, JSON.stringify(trData).substring(0, 300));
          rawData.trainingReadiness = trData;
          parts.push(parseTrainingReadiness(trData, d));
        }
      } catch (e) {
        console.error(`[garmin-sync] TR fetch failed for ${d}:`, (e as Error).message);
      }

      if (parts.length > 0) {
        const merged = mergeHealthMetrics(...parts);
        const upsertData = {
          ...merged,
          rawData: rawData as Prisma.InputJsonValue,
        };
        await prisma.healthMetric.upsert({
          where: { userId_date: { userId, date: new Date(d) } },
          update: upsertData,
          create: { userId, date: new Date(d), ...upsertData },
        });
        console.log(`[garmin-sync] Health metrics saved for ${d}:`, Object.keys(merged).join(', '));
      }
    } catch (err) {
      console.error(`[garmin-sync] Health error for ${d}:`, err);
    }
  }

  // Sync activities — also fetch GPS + streams for each
  try {
    const activities = await client.getActivities(0, 20);
    for (const raw of activities) {
      const parsed = parseGarminActivity(raw);

      // Fetch full details (GPS + streams)
      let detailsData: Record<string, unknown> = {};
      let lapsData: Prisma.InputJsonValue | null = null;
      try {
        const details = await client.getActivityDetails(raw.activityId);
        const splits = await client.getActivitySplits(raw.activityId);
        detailsData = details as Record<string, unknown>;
        if (splits.lapDTOs?.length) {
          lapsData = splits.lapDTOs as unknown as Prisma.InputJsonValue;
        }
      } catch (err) {
        console.error(`[garmin-sync] Details fetch failed for ${raw.activityId}:`, err);
      }

      const data = {
        ...parsed,
        sport: parsed.sport as Sport,
        rawData: { ...(parsed.rawData as object ?? {}), details: detailsData } as Prisma.InputJsonValue,
        laps: lapsData ?? Prisma.JsonNull,
        userId,
      };
      await prisma.activity.upsert({
        where: { source_externalId: { source: 'GARMIN', externalId: parsed.externalId } },
        update: data,
        create: data,
      });
    }
    console.log(`[garmin-sync] ${activities.length} activities synced`);
  } catch (err) {
    console.error('[garmin-sync] Activities error:', err);
  }

  console.log(`[${new Date().toISOString()}] [garmin-sync] Completed for user ${userId}`);
}

export async function garminSyncJob(job: Job<GarminSyncJobData>): Promise<void> {
  const { date } = job.data;
  const mode = job.data.mode ?? 'quick';
  console.log(`[${new Date().toISOString()}] [garmin-sync] Job started mode=${mode}`);

  if (job.data.triggerAllUsers) {
    const users = await prisma.user.findMany({ select: { id: true } });
    console.log(`[garmin-sync] Fan-out: syncing ${users.length} users`);
    for (const user of users) {
      try {
        await syncGarminForUser(user.id, mode, date);
      } catch (err) {
        console.error(`[garmin-sync] Error for user ${user.id}:`, err);
      }
    }
  } else if (job.data.userId) {
    await syncGarminForUser(job.data.userId, mode, date);
  } else {
    console.warn('[garmin-sync] Job has no userId and triggerAllUsers is not set, skipping');
  }

  await job.updateProgress(100);
  console.log(`[${new Date().toISOString()}] [garmin-sync] Job completed`);
}
