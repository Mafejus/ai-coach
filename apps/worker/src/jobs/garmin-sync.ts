import type { Job } from 'bullmq';
import { prisma, Prisma } from '@ai-coach/db';
import type { Sport } from '@ai-coach/db';
import { GarminClient } from '@ai-coach/garmin';
import {
  parseSleepToHealthMetric,
  parseHRToHealthMetric,
  parseHRVToHealthMetric,
  parseUserSummaryToHealthMetric,
  mergeHealthMetrics,
  parseGarminActivity,
} from '@ai-coach/garmin';
import { toISODate, addDays } from '@ai-coach/shared';

interface GarminSyncJobData {
  userId: string;
  date?: string;
}

async function decryptPassword(encrypted: string): Promise<string> {
  // Import encryption from web app is not possible in worker
  // Worker needs its own encryption util — use same logic
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

export async function garminSyncJob(job: Job<GarminSyncJobData>): Promise<void> {
  const { userId, date } = job.data;
  console.log(`[${new Date().toISOString()}] [garmin-sync] Starting for user ${userId}`);

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

  const syncDate = date ?? toISODate(new Date());
  const yesterday = toISODate(new Date(Date.now() - 86400_000));
  const dates = date ? [date] : [yesterday, syncDate];

  // Sync health metrics
  for (const d of dates) {
    try {
      const [sleep, hr, hrv, summary] = await Promise.allSettled([
        client.getSleepData(d),
        client.getHeartRate(d),
        client.getHRVData(d),
        client.getUserSummary(d),
      ]);

      const parts: Record<string, unknown>[] = [];
      if (sleep.status === 'fulfilled') parts.push(parseSleepToHealthMetric(sleep.value));
      if (hr.status === 'fulfilled') parts.push(parseHRToHealthMetric(hr.value));
      if (hrv.status === 'fulfilled') parts.push(parseHRVToHealthMetric(hrv.value));
      if (summary.status === 'fulfilled') parts.push(parseUserSummaryToHealthMetric(summary.value));

      if (parts.length > 0) {
        const merged = mergeHealthMetrics(...parts);
        await prisma.healthMetric.upsert({
          where: { userId_date: { userId, date: new Date(d) } },
          update: merged,
          create: { userId, date: new Date(d), ...merged },
        });
        console.log(`[garmin-sync] Health metrics saved for ${d}`);
      }
    } catch (err) {
      console.error(`[garmin-sync] Health error for ${d}:`, err);
    }
  }

  // Sync activities
  try {
    const activities = await client.getActivities(0, 20);
    for (const raw of activities) {
      const parsed = parseGarminActivity(raw);
      const data = {
        ...parsed,
        sport: parsed.sport as Sport,
        rawData: (parsed.rawData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        laps: Prisma.JsonNull,
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

  await job.updateProgress(100);
  console.log(`[${new Date().toISOString()}] [garmin-sync] Completed for user ${userId}`);
}
