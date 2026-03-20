import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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
import { decrypt } from '@/lib/encryption';
import { toISODate } from '@ai-coach/shared';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
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
          where: { id: userId },
          data: { garminSession: sessionJson },
        }).catch((e) => console.error('[sync/garmin] Session save failed:', e));
      },
    });
    await client.authenticate();

    // Persist session after successful auth
    const sessionJson = client.getSessionJson();
    if (sessionJson) {
      await prisma.user.update({
        where: { id: userId },
        data: { garminSession: sessionJson },
      }).catch(() => {});
    }

    let healthUpdated = 0;
    let activitiesUpdated = 0;

    const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

    // Sync health metrics for last 14 days
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      dates.push(toISODate(new Date(Date.now() - i * 86400_000)));
    }
    dates.reverse();

    for (const date of dates) {
      try {
        console.log(`[garmin-api-sync] Syncing health for ${date}...`);
        
        const parts: Record<string, unknown>[] = [];
        const rawData: Record<string, unknown> = {};

        // 1. Sleep
        try {
          const sleepData = await client.getSleepData(date);
          rawData.sleep = sleepData;
          parts.push(parseSleepToHealthMetric(sleepData));
          await wait(2000);
        } catch (e) {
          console.error(`[garmin-api-sync] Sleep failed ${date}:`, (e as Error).message);
        }
        
        // 2. HR
        try {
          const hrData = await client.getHeartRate(date);
          rawData.heartRate = hrData;
          parts.push(parseHRToHealthMetric(hrData));
          await wait(2000);
        } catch (e) {
          console.error(`[garmin-api-sync] HR failed ${date}:`, (e as Error).message);
        }
        
        // 3. HRV
        try {
          const hrvData = await client.getHRVData(date);
          rawData.hrv = hrvData;
          parts.push(parseHRVToHealthMetric(hrvData));
          await wait(2000);
        } catch (e) {
          console.error(`[garmin-api-sync] HRV failed ${date}:`, (e as Error).message);
        }
        
        // 4. User Summary (Body Battery, Stress)
        try {
          const summaryData = await client.getUserSummary(date);
          rawData.userSummary = summaryData;
          parts.push(parseUserSummaryToHealthMetric(summaryData));
          await wait(2000);
        } catch (e) {
          console.error(`[garmin-api-sync] Summary failed ${date}:`, (e as Error).message);
        }

        // 5. Training Readiness — dedicated endpoint, NOT in daily summary
        try {
          const trData = await client.getTrainingReadiness(date);
          rawData.trainingReadiness = trData;
          parts.push(parseTrainingReadiness(trData, date));
          await wait(2000);
        } catch (e) {
          console.error(`[garmin-api-sync] TrainingReadiness failed ${date}:`, (e as Error).message);
        }

        if (parts.length > 0) {
          const merged = mergeHealthMetrics(...parts);
          await prisma.healthMetric.upsert({
            where: { userId_date: { userId, date: new Date(date) } },
            update: { ...merged, rawData: rawData as Prisma.InputJsonValue },
            create: { userId, date: new Date(date), ...merged, rawData: rawData as Prisma.InputJsonValue },
          });
          console.log(`[garmin-api-sync] Saved ${date}:`, Object.keys(merged).join(', '));
          healthUpdated++;
        }
      } catch (e) {
        console.error(`[garmin-api-sync] Error for date ${date}:`, (e as Error).message);
      }
    }

    // Sync recent activities (last 50)
    try {
      const activities = await client.getActivities(0, 50);
      for (const raw of activities) {
        try {
          const parsed = parseGarminActivity(raw);

          const activityDate = new Date(raw.startTimeLocal);
          const windowMs = 5 * 60 * 1000;
          
          const existing = await prisma.activity.findFirst({
            where: {
              userId,
              date: {
                gte: new Date(activityDate.getTime() - windowMs),
                lte: new Date(activityDate.getTime() + windowMs),
              },
            },
          });

          if (existing) {
            await prisma.activity.update({
              where: { id: existing.id },
              data: {
                avgHR: existing.avgHR ?? parsed.avgHR,
                maxHR: existing.maxHR ?? parsed.maxHR,
                avgCadence: existing.avgCadence ?? parsed.avgCadence,
                elevationGain: existing.elevationGain ?? parsed.elevationGain,
                trainingLoad: existing.trainingLoad ?? parsed.trainingLoad,
                rawData: { ...(existing.rawData as object ?? {}), garminActivityId: parsed.externalId, garminRaw: raw } as unknown as Prisma.InputJsonValue,
              },
            });
            activitiesUpdated++;
          } else {
            // Only pass fields that exist in Prisma schema — aerobicTrainingEffect etc. go into rawData only
            const { aerobicTrainingEffect, anaerobicTrainingEffect, ...activityData } = parsed;
            const data = {
              ...activityData,
              sport: activityData.sport as Sport,
              rawData: {
                ...(activityData.rawData as object ?? {}),
                garminRaw: raw,
                aerobicTrainingEffect,
                anaerobicTrainingEffect,
              } as unknown as Prisma.InputJsonValue,
              userId,
            };
            await prisma.activity.create({ data });
            activitiesUpdated++;
          }
        } catch (err) {
          console.error(`[garmin-api-sync] Activity error:`, err);
        }
      }
    } catch (err) {
      console.error(`[garmin-api-sync] Activities fetch error:`, err);
    }

    return NextResponse.json({
      success: true,
      healthUpdated,
      activitiesUpdated,
      total: healthUpdated + activitiesUpdated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sync/garmin] Error:', err);
    return NextResponse.json({ error: 'Sync failed', details: String(err) }, { status: 500 });
  }
}
