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

    const today = toISODate(new Date());
    const yesterday = toISODate(new Date(Date.now() - 86400_000));
    let healthUpdated = 0;
    let activitiesUpdated = 0;

    // Sync health metrics for yesterday + today
    for (const date of [yesterday, today]) {
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

    // Sync recent activities (last 20)
    try {
      const activities = await client.getActivities(0, 20);
      for (const raw of activities) {
        try {
          const parsed = parseGarminActivity(raw);
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
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sync/garmin] Error:', err);
    return NextResponse.json({ error: 'Sync failed', details: String(err) }, { status: 500 });
  }
}
