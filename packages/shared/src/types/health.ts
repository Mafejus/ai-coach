export interface HealthMetricData {
  date: string; // ISO date
  sleepScore?: number;
  sleepDuration?: number; // minutes
  deepSleep?: number; // minutes
  remSleep?: number; // minutes
  lightSleep?: number; // minutes
  awakeDuration?: number; // minutes
  sleepStart?: string;
  sleepEnd?: string;
  restingHR?: number;
  hrvStatus?: number; // ms
  hrvBaseline?: number; // ms
  bodyBattery?: number; // 0-100
  bodyBatteryChange?: number;
  stressScore?: number; // 0-100
  trainingReadiness?: number; // 0-100
  vo2max?: number;
  spo2Avg?: number;
  spo2Min?: number;
}
