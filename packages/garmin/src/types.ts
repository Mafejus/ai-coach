export interface GarminSleepData {
  calendarDate: string;
  sleepTimeSeconds: number;
  sleepScores?: { overall: { value: number } };
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSleepSeconds?: number;
  sleepStartTimestampLocal?: number;
  sleepEndTimestampLocal?: number;
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
  calendarDate: string;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  totalKilocalories?: number;
  totalSteps?: number;
  bodyBatteryMostRecentValue?: number;
  averageStressLevel?: number;
  trainingReadinessScore?: number;
  vo2MaxValue?: number;
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
