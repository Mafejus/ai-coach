export interface GarminSleepDTO {
  calendarDate: string;
  sleepTimeSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSleepSeconds: number;
  sleepStartTimestampLocal: number;
  sleepEndTimestampLocal: number;
  averageSpO2Value?: number;
  lowestSpO2Value?: number;
  avgHeartRate?: number;
  sleepScores?: {
    overall?: { value: number };
  };
}

export interface GarminSleepData {
  dailySleepDTO: GarminSleepDTO;
  avgOvernightHrv?: number;
  restingHeartRate?: number;
  bodyBatteryChange?: number;
  hrvStatus?: string;
}

export interface GarminHeartRateData {
  calendarDate: string;
  restingHeartRate?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
}

export interface GarminHRVData {
  calendarDate: string;
  hrvSummary?: {
    weeklyAvg?: number;
    // Garmin API uses different field names depending on device/firmware version.
    // All known variants are listed here — parsers use the first non-null value.
    lastNight?: number;        // newer firmware
    lastNightAvg?: number;     // older firmware / some devices
    lastNight5MinHigh?: number;
    status: string;
    baseline?: {
      lowUpper: number;
      balancedLow: number;
      balancedUpper: number;
    } | null;
  };
}

export interface GarminBodyBattery {
  date: string;
  charged: number;
  drained: number;
  startValue?: number;
  endValue?: number;
}

export interface GarminUserSummary {
  calendarDate?: string;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  totalKilocalories?: number;
  totalSteps?: number;
  totalDistanceMeters?: number;
  // Body Battery — from daily summary endpoint
  bodyBatteryMostRecentValue?: number;
  bodyBatteryHighestValue?: number;
  bodyBatteryLowestValue?: number;
  // Charged = how much was gained during sleep (Body Recovery)
  bodyBatteryChargedValue?: number;
  bodyBatteryDrainedValue?: number;
  // Stress
  averageStressLevel?: number;
  maxStressLevel?: number;
  stressQualifier?: string;
  stressValuesArray?: Array<[number, number]>;
  bodyBatteryValuesArray?: Array<[number, number]>;
  // Heart Rate
  restingHeartRate?: number;
  lastSevenDaysAvgRestingHeartRate?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  // SpO2
  averageSpo2?: number;
  lowestSpo2?: number;
  // Activity
  highlyActiveSeconds?: number;
  activeSeconds?: number;
  // NOTE: trainingReadinessScore is NOT in daily summary — use getTrainingReadiness() separately
  trainingReadinessScore?: number;
  vo2MaxValue?: number;
  fitnessAge?: number;
}

/**
 * Training Readiness response from training-readiness-service endpoint.
 * Returns an array of daily readiness objects.
 */
export interface GarminTrainingReadinessDay {
  calendarDate: string;
  // Score is 0–100. Field name varies slightly between API versions:
  trainingReadinessScore?: number;
  score?: number;
  // Contributing factors:
  acuteLoad?: number;
  sleepScore?: number;
  recoveryTime?: number;
  hrv?: number;
  hrvBaseline?: number;
}

export type GarminTrainingReadiness = GarminTrainingReadinessDay[];

export interface GarminActivity {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  duration: number; // seconds
  distance?: number; // meters
  averageHR?: number;
  maxHR?: number;
  averageSpeed?: number;
  calories?: number;
  elevationGain?: number;
  averageCadence?: number;
  activityType: { typeKey: string };
  aerobicTrainingEffect?: number;
  anaerobicTrainingEffect?: number;
  trainingLoad?: number;
  trainingStressScore?: number;
}

export interface GarminCredentials {
  email: string;
  password: string; // encrypted in DB
}

export interface GarminGPSPoint {
  lat: number;
  lon: number;
  altitude?: number;
  time?: number;
  distanceInMeters?: number;
  speed?: number;
}

export interface GarminActivityDetails {
  geoPolylineDTO?: {
    polyline?: GarminGPSPoint[];
    minLat?: number;
    maxLat?: number;
    minLon?: number;
    maxLon?: number;
  };
  metricDescriptors?: Array<{
    metricsIndex: number;
    key: string;
    unit?: { key: string };
  }>;
  activityDetailMetrics?: Array<{
    startTimeGMT?: string;
    metrics: (number | null)[];
  }>;
}

export interface GarminLap {
  lapIndex?: number;
  startTimeGMT?: string;
  distanceInMeters?: number;
  elapsedDuration?: number;
  movingDuration?: number;
  averageSpeed?: number;
  averageHR?: number;
  maximumHR?: number;
  averageRunCadence?: number;
  totalAscent?: number;
  totalDescent?: number;
}

export interface GarminActivitySplits {
  lapDTOs?: GarminLap[];
}

export interface GarminDailyHeartRate {
  calendarDate: string;
  restingHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  heartRateValueDescriptors?: Array<{ index: number; key: string }>;
  heartRateValues?: Array<[number, number | null]>; // [timestamp_ms, bpm]
}
