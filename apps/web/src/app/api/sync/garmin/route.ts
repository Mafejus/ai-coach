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

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
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

    // Sync health metrics for last 14 days
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      dates.push(toISODate(new Date(Date.now() - i * 86400_000)));
    }

    for (const date of dates) {
      try {
        const [sleep, hr, hrv, summary] = await Promise.allSettled([
          client.getSleepData(date),
          client.getHeartRate(date),
          client.getHRVData(date),
          client.getUserSummary(date),
        ]);

        const parts: Record<string, unknown>[] = [];
        if (sleep.status === 'fulfilled') parts.push(parseSleepToHealthMetric(sleep.value));
        if (hr.status === 'fulfilled') parts.push(parseHRToHealthMetric(hr.value));
        if (hrv.status === 'fulfilled') parts.push(parseHRVToHealthMetric(hrv.value));
        if (summary.status === 'fulfilled') parts.push(parseUserSummaryToHealthMetric(summary.value));

        if (parts.length > 0) {
          const merged = mergeHealthMetrics(...parts);
          await prisma.healthMetric.upsert({
            where: { userId_date: { userId: session.user.id, date: new Date(date) } },
            update: merged,
            create: { userId: session.user.id, date: new Date(date), ...merged },
          });
          healthUpdated++;
        }
      } catch (err) {
        console.error(`[sync/garmin] Health metrics error for ${date}:`, err);
      }
    }

    // Sync recent activities (last 50 to cover 14 days)
    try {
      const activities = await client.getActivities(0, 50);
      for (const raw of activities) {
        try {
          const parsed = parseGarminActivity(raw);

          // Deduplication: check if a Strava activity exists for the same workout
          // Match by date (±5 min) and distance (±10%)
          const activityDate = new Date(raw.startTimeLocal);
          const windowMs = 5 * 60 * 1000;
          const stravaMatch = parsed.distance != null
            ? await prisma.activity.findFirst({
                where: {
                  userId: session.user.id,
                  source: 'STRAVA',
                  date: {
                    gte: new Date(activityDate.getTime() - windowMs),
                    lte: new Date(activityDate.getTime() + windowMs),
                  },
                  distance: {
                    gte: parsed.distance * 0.9,
                    lte: parsed.distance * 1.1,
                  },
                },
              })
            : await prisma.activity.findFirst({
                where: {
                  userId: session.user.id,
                  source: 'STRAVA',
                  date: {
                    gte: new Date(activityDate.getTime() - windowMs),
                    lte: new Date(activityDate.getTime() + windowMs),
                  },
                },
              });

          if (stravaMatch) {
            // Merge Garmin-specific metrics into the existing Strava activity
            const stravaRaw = (stravaMatch.rawData as Record<string, unknown>) ?? {};
            await prisma.activity.update({
              where: { id: stravaMatch.id },
              data: {
                avgHR: stravaMatch.avgHR ?? parsed.avgHR,
                maxHR: stravaMatch.maxHR ?? parsed.maxHR,
                avgCadence: stravaMatch.avgCadence ?? parsed.avgCadence,
                elevationGain: stravaMatch.elevationGain ?? parsed.elevationGain,
                rawData: { ...stravaRaw, garminActivityId: parsed.externalId } as Prisma.InputJsonValue,
              },
            });
            activitiesUpdated++;
          } else {
            const data = {
              ...parsed,
              sport: parsed.sport as Sport,
              rawData: (parsed.rawData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              laps: Prisma.JsonNull,
              userId: session.user.id,
            };
            await prisma.activity.upsert({
              where: { source_externalId: { source: 'GARMIN', externalId: parsed.externalId } },
              update: data,
              create: data,
            });
            activitiesUpdated++;
          }
        } catch (err) {
          console.error(`[sync/garmin] Activity upsert error:`, err);
        }
      }
    } catch (err) {
      console.error(`[sync/garmin] Activities error:`, err);
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
