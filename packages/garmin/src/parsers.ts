import type {
  GarminSleepData,
  GarminHeartRateData,
  GarminHRVData,
  GarminUserSummary,
  GarminActivity,
} from './types';

// Map Garmin activity type keys to our Sport enum
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
  return {
    sleepScore: sleep.sleepScores?.overall?.value ?? null,
    sleepDuration: sleep.sleepTimeSeconds != null
      ? Math.floor(sleep.sleepTimeSeconds / 60)
      : null,
    deepSleep: sleep.deepSleepSeconds != null
      ? Math.floor(sleep.deepSleepSeconds / 60)
      : null,
    lightSleep: sleep.lightSleepSeconds != null
      ? Math.floor(sleep.lightSleepSeconds / 60)
      : null,
    remSleep: sleep.remSleepSeconds != null
      ? Math.floor(sleep.remSleepSeconds / 60)
      : null,
    awakeDuration: sleep.awakeSleepSeconds != null
      ? Math.floor(sleep.awakeSleepSeconds / 60)
      : null,
    sleepStart: sleep.sleepStartTimestampLocal
      ? new Date(sleep.sleepStartTimestampLocal * 1000)
      : null,
    sleepEnd: sleep.sleepEndTimestampLocal
      ? new Date(sleep.sleepEndTimestampLocal * 1000)
      : null,
  };
}

export function parseHRToHealthMetric(hr: GarminHeartRateData): Record<string, unknown> {
  return {
    restingHR: hr.restingHeartRate ?? null,
  };
}

export function parseHRVToHealthMetric(hrv: GarminHRVData): Record<string, unknown> {
  return {
    hrvStatus: hrv.hrvSummary?.lastNight ?? hrv.hrvSummary?.weeklyAvg ?? null,
    hrvBaseline: hrv.hrvSummary?.baseline?.balancedLow ?? null,
  };
}

export function parseUserSummaryToHealthMetric(summary: GarminUserSummary): Record<string, unknown> {
  return {
    bodyBattery: summary.bodyBatteryMostRecentValue ?? null,
    bodyBatteryChange: null,
    stressScore: summary.averageStressLevel ?? null,
    trainingReadiness: summary.trainingReadinessScore ?? null,
    vo2max: summary.vo2MaxValue ?? null,
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

  // Calculate avgPace in sec/km from averageSpeed (m/s)
  let avgPace: number | null = null;
  if (activity.averageSpeed && activity.averageSpeed > 0 && (sport === 'RUN' || sport === 'SWIM')) {
    avgPace = 1000 / activity.averageSpeed; // sec/km
  }

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
    rawData: activity as unknown as Record<string, unknown>,
  };
}
