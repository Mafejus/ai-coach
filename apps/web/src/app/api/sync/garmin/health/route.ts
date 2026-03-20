import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { GarminClient } from '@ai-coach/garmin';
import {
  parseSleepToHealthMetric,
  parseHRToHealthMetric,
  parseHRVToHealthMetric,
  parseUserSummaryToHealthMetric,
  parseTrainingReadiness,
  mergeHealthMetrics,
} from '@ai-coach/garmin';
import { Prisma } from '@ai-coach/db';
import { decrypt } from '@/lib/encryption';
import { toISODate } from '@ai-coach/shared';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { garminEmail: true, garminPassword: true, garminSession: true },
  });

  if (!user.garminEmail || !user.garminPassword) {
    return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });
  }

  try {
    const password = decrypt(user.garminPassword);
    const client = new GarminClient(user.garminEmail, password, {
      savedSession: user.garminSession,
      onSessionChange: async (sessionJson: string) => {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { garminSession: sessionJson },
        }).catch((e) => console.error('[sync/garmin/health] Session save failed:', e));
      },
    });
    await client.authenticate();

    // Persist session after successful auth
    const sessionJson = client.getSessionJson();
    if (sessionJson) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { garminSession: sessionJson },
      }).catch(() => {});
    }

    let healthUpdated = 0;

    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      dates.push(toISODate(new Date(Date.now() - i * 86400_000)));
    }

    for (const date of dates) {
      try {
        const parts: Record<string, unknown>[] = [];
        const rawData: Record<string, unknown> = {};

        // 1. Sleep
        try {
          const sleepData = await client.getSleepData(date);
          console.log(`[sync/garmin/health] Sleep raw ${date}:`, JSON.stringify(sleepData).substring(0, 500));
          rawData.sleep = sleepData;
          parts.push(parseSleepToHealthMetric(sleepData));
        } catch (e) {
          console.error(`[sync/garmin/health] Sleep failed ${date}:`, (e as Error).message);
        }

        // 2. Heart rate
        try {
          const hrData = await client.getHeartRate(date);
          console.log(`[sync/garmin/health] HR raw ${date}:`, JSON.stringify(hrData).substring(0, 300));
          rawData.heartRate = hrData;
          parts.push(parseHRToHealthMetric(hrData));
        } catch (e) {
          console.error(`[sync/garmin/health] HR failed ${date}:`, (e as Error).message);
        }

        // 3. HRV
        try {
          const hrvData = await client.getHRVData(date);
          console.log(`[sync/garmin/health] HRV raw ${date}:`, JSON.stringify(hrvData).substring(0, 300));
          rawData.hrv = hrvData;
          parts.push(parseHRVToHealthMetric(hrvData));
        } catch (e) {
          console.error(`[sync/garmin/health] HRV failed ${date}:`, (e as Error).message);
        }

        // 4. User summary (Body Battery, Stress, Resting HR)
        try {
          const summaryData = await client.getUserSummary(date);
          console.log(`[sync/garmin/health] Summary raw ${date}:`, JSON.stringify(summaryData).substring(0, 500));
          rawData.userSummary = summaryData;
          parts.push(parseUserSummaryToHealthMetric(summaryData));
        } catch (e) {
          console.error(`[sync/garmin/health] Summary failed ${date}:`, (e as Error).message);
        }

        // 5. Training Readiness — dedicated endpoint, NOT in daily summary
        try {
          const trData = await client.getTrainingReadiness(date);
          console.log(`[sync/garmin/health] TrainingReadiness raw ${date}:`, JSON.stringify(trData).substring(0, 300));
          rawData.trainingReadiness = trData;
          parts.push(parseTrainingReadiness(trData, date));
        } catch (e) {
          console.error(`[sync/garmin/health] TrainingReadiness failed ${date}:`, (e as Error).message);
        }

        if (parts.length > 0) {
          const merged = mergeHealthMetrics(...parts);
          const upsertData = {
            ...merged,
            rawData: rawData as Prisma.InputJsonValue,
          };
          await prisma.healthMetric.upsert({
            where: { userId_date: { userId: session.user.id, date: new Date(date) } },
            update: upsertData,
            create: { userId: session.user.id, date: new Date(date), ...upsertData },
          });
          console.log(`[sync/garmin/health] Saved for ${date}:`, Object.keys(merged).join(', '));
          healthUpdated++;
        }
      } catch (err) {
        console.error(`[sync/garmin/health] Error for ${date}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      healthUpdated,
      total: healthUpdated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sync/garmin/health] Error:', err);
    return NextResponse.json({ error: 'Sync failed', details: String(err) }, { status: 500 });
  }
}
