import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { GarminClient } from '@ai-coach/garmin';
import {
  parseSleepToHealthMetric,
  parseHRToHealthMetric,
  parseHRVToHealthMetric,
  parseUserSummaryToHealthMetric,
  mergeHealthMetrics,
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
