export interface GarminSleepDTO {
  calendarDate: string;
  sleepTimeSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSleepSeconds: number;
  sleepStartTimestampLocal: number;
  sleepEndTimestampLocal: number;
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
    weeklyAvg: number;
    lastNight: number;
    lastNightAvg: number;
    status: string;
    baseline?: {
      lowUpper: number;
      balancedLow: number;
      balancedUpper: number;
    };
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
  bodyBatteryMostRecentValue?: number;
  highlyActiveSeconds?: number;
  activeSeconds?: number;
  averageStressLevel?: number;
  maxStressLevel?: number;
  stressQualifier?: string;
  trainingReadinessScore?: number;
  trainingReadinessDescription?: string;
  vo2MaxValue?: number;
  fitnessAge?: number;
  measurableAwakeDuration?: number;
  measurableAsleepDuration?: number;
}

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
}

export interface GarminCredentials {
  email: string;
  password: string; // encrypted in DB
}
