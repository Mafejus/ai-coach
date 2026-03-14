import type {
  GarminSleepData,
  GarminHeartRateData,
  GarminHRVData,
  GarminUserSummary,
  GarminActivity,
} from './types';
import type { HealthMetricData } from '@ai-coach/shared';

export function parseSleepToHealthMetric(sleep: GarminSleepData): Partial<HealthMetricData> {
  return {
    date: sleep.calendarDate,
    sleepScore: sleep.sleepScores?.overall.value,
    sleepDuration: sleep.sleepTimeSeconds ? Math.floor(sleep.sleepTimeSeconds / 60) : undefined,
    deepSleep: sleep.deepSleepSeconds ? Math.floor(sleep.deepSleepSeconds / 60) : undefined,
    lightSleep: sleep.lightSleepSeconds ? Math.floor(sleep.lightSleepSeconds / 60) : undefined,
    remSleep: sleep.remSleepSeconds ? Math.floor(sleep.remSleepSeconds / 60) : undefined,
    awakeDuration: sleep.awakeSleepSeconds
      ? Math.floor(sleep.awakeSleepSeconds / 60)
      : undefined,
  };
}

export function parseHRToHealthMetric(hr: GarminHeartRateData): Partial<HealthMetricData> {
  return {
    date: hr.calendarDate,
    restingHR: hr.restingHeartRate,
  };
}

export function parseHRVToHealthMetric(hrv: GarminHRVData): Partial<HealthMetricData> {
  return {
    date: hrv.calendarDate,
    hrvStatus: hrv.hrvSummary?.lastNight,
    hrvBaseline: hrv.hrvSummary?.baseline?.balancedLow,
  };
}

export function parseUserSummaryToHealthMetric(
  summary: GarminUserSummary,
): Partial<HealthMetricData> {
  return {
    date: summary.calendarDate,
    bodyBattery: summary.bodyBatteryMostRecentValue,
    stressScore: summary.averageStressLevel,
    trainingReadiness: summary.trainingReadinessScore,
    vo2max: summary.vo2MaxValue,
  };
}

export function mergeHealthMetrics(
  ...parts: Partial<HealthMetricData>[]
): Partial<HealthMetricData> {
  return Object.assign({}, ...parts);
}

export function parseActivitySport(typeKey: string): string {
  const mapping: Record<string, string> = {
    running: 'RUN',
    cycling: 'BIKE',
    swimming: 'SWIM',
    lap_swimming: 'SWIM',
    strength_training: 'STRENGTH',
    triathlon: 'TRIATHLON',
  };
  return mapping[typeKey] ?? 'OTHER';
}

export function parseGarminActivity(activity: GarminActivity) {
  return {
    externalId: String(activity.activityId),
    name: activity.activityName,
    date: new Date(activity.startTimeLocal),
    duration: activity.duration,
    distance: activity.distance,
    avgHR: activity.averageHR,
    maxHR: activity.maxHR,
    calories: activity.calories,
    elevationGain: activity.elevationGain,
    avgCadence: activity.averageCadence,
    sport: parseActivitySport(activity.activityType.typeKey),
    rawData: activity,
  };
}
