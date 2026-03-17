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
    select: { garminEmail: true, garminPassword: true },
  });

  if (!user.garminEmail || !user.garminPassword) {
    return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });
  }

  try {
    const password = decrypt(user.garminPassword);
    const client = new GarminClient(user.garminEmail, password);
    await client.authenticate();

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
        
        // 1. Sleep
        const sleepData = await client.getSleepData(date);
        await wait(2000);
        
        // 2. HR
        const hrData = await client.getHeartRate(date);
        await wait(2000);
        
        // 3. HRV
        const hrvData = await client.getHRVData(date);
        await wait(2000);
        
        // 4. User Summary
        const summaryData = await client.getUserSummary(date);
        await wait(2000);

        const parts = [
          parseSleepToHealthMetric(sleepData),
          parseHRToHealthMetric(hrData),
          parseHRVToHealthMetric(hrvData),
          parseUserSummaryToHealthMetric(summaryData),
        ];

        const merged = mergeHealthMetrics(...parts);
        const rawData = { sleep: sleepData, heartRate: hrData, hrv: hrvData, userSummary: summaryData };

        await prisma.healthMetric.upsert({
          where: { userId_date: { userId, date: new Date(date) } },
          update: { ...merged, rawData: rawData as any },
          create: { userId, date: new Date(date), ...merged, rawData: rawData as any },
        });
        healthUpdated++;
      } catch (e) {
        console.error(`[garmin-api-sync] Error for date ${date}:`, (e as Error).message);
      }
    }

    // Sync recent activities (last 50 to cover 14+ days)
    try {
      const activities = await client.getActivities(0, 50);
      for (const raw of activities) {
        try {
          const parsed = parseGarminActivity(raw);

          // Deduplication with Strava or existing activities
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
            // Merge Garmin data into existing activity
            await prisma.activity.update({
              where: { id: existing.id },
              data: {
                avgHR: existing.avgHR ?? parsed.avgHR,
                maxHR: existing.maxHR ?? parsed.maxHR,
                avgCadence: existing.avgCadence ?? parsed.avgCadence,
                elevationGain: existing.elevationGain ?? parsed.elevationGain,
                trainingLoad: existing.trainingLoad ?? parsed.trainingLoad,
                rawData: { ...(existing.rawData as object ?? {}), garminActivityId: parsed.externalId, garminRaw: raw } as any,
              },
            });
            activitiesUpdated++;
          } else {
            const data = {
              ...parsed,
              sport: parsed.sport as Sport,
              rawData: { ...(parsed.rawData as object ?? {}), garminRaw: raw } as any,
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
