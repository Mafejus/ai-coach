// Garmin Connect client using garmin-connect npm package
// ⚠️ Unofficial API — may break at any time
// Rate limit: max 1 request / 2 seconds

import { GarminConnect } from 'garmin-connect';
import type {
  GarminSleepData,
  GarminHeartRateData,
  GarminHRVData,
  GarminUserSummary,
  GarminActivity,
} from './types';

const RATE_LIMIT_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GarminClient {
  private gc: GarminConnect;
  private lastRequestAt = 0;

  constructor(private readonly email: string, private readonly password: string) {
    this.gc = new GarminConnect({ username: email, password });
  }

  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < RATE_LIMIT_MS) {
      await sleep(RATE_LIMIT_MS - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  async authenticate(): Promise<void> {
    await this.gc.login(this.email, this.password);
  }

  async getSleepData(date: string): Promise<GarminSleepData> {
    await this.rateLimit();
    const data = await this.gc.getSleepData(new Date(date));
    return data as unknown as GarminSleepData;
  }

  async getHeartRate(date: string): Promise<GarminHeartRateData> {
    await this.rateLimit();
    const data = await this.gc.getHeartRate(new Date(date));
    return data as unknown as GarminHeartRateData;
  }

  async getHRVData(date: string): Promise<GarminHRVData> {
    await this.rateLimit();
    try {
      const data = await (this.gc as unknown as { getHRVData: (d: Date) => Promise<unknown> }).getHRVData(new Date(date));
      return data as GarminHRVData;
    } catch {
      // HRV data not always available
      return { calendarDate: date };
    }
  }

  async getUserSummary(date: string): Promise<GarminUserSummary> {
    await this.rateLimit();
    // getUserSummary not available in this version — use getUserSettings as fallback
    const data = await (this.gc as unknown as { getUserSettings: () => Promise<unknown> }).getUserSettings();
    return data as unknown as GarminUserSummary;
  }

  async getActivities(start: number, limit: number): Promise<GarminActivity[]> {
    await this.rateLimit();
    const data = await this.gc.getActivities(start, limit);
    return (Array.isArray(data) ? data : []) as unknown as GarminActivity[];
  }

  async getActivityDetails(activityId: number): Promise<GarminActivity> {
    await this.rateLimit();
    const data = await this.gc.getActivity({ activityId } as unknown as Parameters<typeof this.gc.getActivity>[0]);
    return data as unknown as GarminActivity;
  }

  async getTrainingStatus(date: string): Promise<GarminUserSummary> {
    // Training status included in user summary
    return this.getUserSummary(date);
  }
}
