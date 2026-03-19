import type {
  GarminSleepData,
  GarminHeartRateData,
  GarminHRVData,
  GarminUserSummary,
  GarminActivity,
  GarminTrainingReadiness,
} from './types';

const SPORT_MAP: Record<string, string> = {
  running: 'RUN',
  trail_running: 'RUN',
  treadmill_running: 'RUN',
  cycling: 'BIKE',
  road_biking: 'BIKE',
  mountain_biking: 'BIKE',
  virtual_ride: 'BIKE',
  swimming: 'SWIM',
  lap_swimming: 'SWIM',
  open_water_swimming: 'SWIM',
  strength_training: 'STRENGTH',
  triathlon: 'TRIATHLON',
  multi_sport: 'TRIATHLON',
};

export function parseActivitySport(typeKey: string | undefined): string {
  if (!typeKey) return 'OTHER';
  return SPORT_MAP[typeKey.toLowerCase()] ?? 'OTHER';
}

export function parseSleepToHealthMetric(sleep: GarminSleepData): Record<string, unknown> {
  const dto = sleep.dailySleepDTO;
  return {
    sleepScore: dto?.sleepScores?.overall?.value ?? null,
    sleepDuration: dto?.sleepTimeSeconds != null ? Math.floor(dto.sleepTimeSeconds / 60) : null,
    deepSleep: dto?.deepSleepSeconds != null ? Math.floor(dto.deepSleepSeconds / 60) : null,
    lightSleep: dto?.lightSleepSeconds != null ? Math.floor(dto.lightSleepSeconds / 60) : null,
    remSleep: dto?.remSleepSeconds != null ? Math.floor(dto.remSleepSeconds / 60) : null,
    awakeDuration: dto?.awakeSleepSeconds != null ? Math.floor(dto.awakeSleepSeconds / 60) : null,
    sleepStart: dto?.sleepStartTimestampLocal ? new Date(dto.sleepStartTimestampLocal) : null,
    sleepEnd: dto?.sleepEndTimestampLocal ? new Date(dto.sleepEndTimestampLocal) : null,
    spo2Avg: dto?.averageSpO2Value ?? null,
    spo2Min: dto?.lowestSpO2Value ?? null,
    restingHR: sleep.restingHeartRate ?? null,
    hrvStatus: sleep.avgOvernightHrv ?? null,
    bodyBatteryChange: sleep.bodyBatteryChange ?? null,
  };
}

export function parseHRToHealthMetric(hr: GarminHeartRateData): Record<string, unknown> {
  return {
    restingHR: hr.restingHeartRate ?? null,
  };
}

export function parseHRVToHealthMetric(hrv: GarminHRVData): Record<string, unknown> {
  // Garmin uses different field names depending on device/firmware version
  const lastNightHrv =
    hrv.hrvSummary?.lastNightAvg ??
    hrv.hrvSummary?.lastNight ??
    hrv.hrvSummary?.weeklyAvg ??
    null;

  console.log('[parseHRVToHealthMetric] raw hrvSummary:', JSON.stringify(hrv.hrvSummary));

  return {
    hrvStatus: lastNightHrv,
    hrvBaseline: hrv.hrvSummary?.baseline?.balancedLow ?? null,
  };
}

export function parseUserSummaryToHealthMetric(summary: GarminUserSummary): Record<string, unknown> {
  const bodyBattery =
    summary.bodyBatteryMostRecentValue ??
    summary.bodyBatteryHighestValue ??
    null;

  const bodyBatteryChange = summary.bodyBatteryChargedValue ?? null;

  console.log('[parseUserSummaryToHealthMetric] bodyBattery:', bodyBattery, '| bodyBatteryChange:', bodyBatteryChange, '| stress:', summary.averageStressLevel);

  return {
    bodyBattery,
    bodyBatteryChange,
    stressScore: summary.averageStressLevel ?? null,
    restingHR: summary.restingHeartRate ?? null,
    spo2Avg: summary.averageSpo2 ?? null,
    spo2Min: summary.lowestSpo2 ?? null,
    // ⚠️ vo2MaxValue is rarely populated in daily summary — mostly null
    vo2max: summary.vo2MaxValue ?? null,
    // trainingReadinessScore is NOT in daily summary — use parseTrainingReadiness() instead
  };
}

/**
 * Parse Training Readiness from the dedicated training-readiness-service endpoint.
 */
export function parseTrainingReadiness(
  data: GarminTrainingReadiness,
  date: string,
): Record<string, unknown> {
  if (!Array.isArray(data) || data.length === 0) {
    return { trainingReadiness: null };
  }

  const entry = data.find(d => d.calendarDate === date) ?? data[0];
  const score = entry?.trainingReadinessScore ?? entry?.score ?? null;

  console.log('[parseTrainingReadiness] date:', date, '| score:', score, '| raw:', JSON.stringify(entry));

  return {
    trainingReadiness: score != null ? Math.round(score) : null,
  };
}

export function mergeHealthMetrics(...parts: Record<string, unknown>[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (value !== null && value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result;
}

export function parseGarminActivity(activity: GarminActivity) {
  const sport = parseActivitySport(activity.activityType?.typeKey);

  let avgPace: number | null = null;
  if (activity.averageSpeed && activity.averageSpeed > 0 && (sport === 'RUN' || sport === 'SWIM')) {
    avgPace = 1000 / activity.averageSpeed;
  }

  // NOTE: aerobicTrainingEffect and anaerobicTrainingEffect are NOT in the Prisma Activity schema.
  // They are returned here so callers can store them in rawData if needed.
  // Do NOT pass them directly to prisma.activity.create/update.
  return {
    source: 'GARMIN' as const,
    externalId: String(activity.activityId),
    sport,
    name: activity.activityName ?? null,
    date: new Date(activity.startTimeLocal),
    duration: Math.round(activity.duration),
    distance: activity.distance ?? null,
    avgHR: activity.averageHR ?? null,
    maxHR: activity.maxHR ?? null,
    avgPace,
    calories: activity.calories ?? null,
    elevationGain: activity.elevationGain ?? null,
    avgCadence: activity.averageCadence ?? null,
    trainingLoad: activity.trainingStressScore ?? activity.trainingLoad ?? null,
    // These go into rawData only — not valid Prisma Activity fields
    aerobicTrainingEffect: activity.aerobicTrainingEffect ?? null,
    anaerobicTrainingEffect: activity.anaerobicTrainingEffect ?? null,
    rawData: activity as unknown as Record<string, unknown>,
  };
}
