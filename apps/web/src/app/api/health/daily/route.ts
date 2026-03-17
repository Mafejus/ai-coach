import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0];

  const metric = await prisma.healthMetric.findFirst({
    where: {
      userId: session.user.id,
      date: new Date(date + 'T00:00:00Z'),
    },
  });

  if (!metric?.rawData) return NextResponse.json({ heartRateValues: [], stressValues: [], bodyBatteryValues: [] });

  const raw = metric.rawData as Record<string, unknown>;
  const hrData = raw.heartRate as { heartRateValues?: Array<[number, number | null]> } | undefined;
  const stressData = raw.userSummary as { stressValuesArray?: Array<[number, number]>; bodyBatteryValuesArray?: Array<[number, number]> } | undefined;

  return NextResponse.json({
    date,
    heartRateValues: hrData?.heartRateValues ?? [],
    stressValues: stressData?.stressValuesArray ?? [],
    bodyBatteryValues: stressData?.bodyBatteryValuesArray ?? [],
    restingHR: metric.restingHR,
    maxHR: (raw.heartRate as Record<string, unknown>)?.maxHeartRate ?? null,
    // Sleep summary
    sleepScore: metric.sleepScore,
    sleepDuration: metric.sleepDuration,
    deepSleep: metric.deepSleep,
    remSleep: metric.remSleep,
    lightSleep: metric.lightSleep,
    awakeDuration: metric.awakeDuration,
    sleepStart: metric.sleepStart ? metric.sleepStart.toISOString() : null,
    sleepEnd: metric.sleepEnd ? metric.sleepEnd.toISOString() : null,
    // Wellness
    bodyBattery: metric.bodyBattery,
    bodyBatteryChange: metric.bodyBatteryChange,
    stressScore: metric.stressScore,
    hrvStatus: metric.hrvStatus,
    trainingReadiness: metric.trainingReadiness,
    vo2max: metric.vo2max,
  });
}
