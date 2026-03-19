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
  GarminActivityDetails,
  GarminActivitySplits,
  GarminDailyHeartRate,
  GarminTrainingReadiness,
} from './types';

const RATE_LIMIT_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GarminClient {
  private gc: GarminConnect;
  private lastRequestAt = 0;
  private displayName: string | null = null;

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
    try {
      const profile = await (this.gc as unknown as { getUserProfile: () => Promise<{ displayName: string }> }).getUserProfile();
      this.displayName = profile?.displayName ?? null;
      console.log('[GarminClient] Authenticated, displayName:', this.displayName);
    } catch {
      console.warn('[GarminClient] Could not fetch display name after login');
    }
  }

  private async getDisplayName(): Promise<string> {
    if (this.displayName) return this.displayName;
    const profile = await (this.gc as unknown as { getUserProfile: () => Promise<{ displayName: string }> }).getUserProfile();
    this.displayName = profile?.displayName;
    if (!this.displayName) throw new Error('Could not get Garmin display name');
    return this.displayName;
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
      const data = await (this.gc as unknown as { get: (url: string) => Promise<unknown> }).get(
        `https://connectapi.garmin.com/hrv-service/hrv/${date}`
      );
      return data as GarminHRVData;
    } catch {
      return { calendarDate: date };
    }
  }

  async getUserSummary(date: string): Promise<GarminUserSummary> {
    await this.rateLimit();
    const displayName = await this.getDisplayName();
    const data = await (this.gc as unknown as { get: (url: string) => Promise<unknown> }).get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`
    );
    return data as unknown as GarminUserSummary;
  }

  /**
   * Training Readiness — separate endpoint, NOT in daily summary.
   * Returns array of daily readiness scores.
   */
  async getTrainingReadiness(date: string): Promise<GarminTrainingReadiness> {
    await this.rateLimit();
    const displayName = await this.getDisplayName();
    try {
      const data = await (this.gc as unknown as { get: (url: string) => Promise<unknown> }).get(
        `https://connectapi.garmin.com/training-readiness-service/stats/training-readiness/${displayName}?fromDate=${date}&untilDate=${date}`
      );
      return data as GarminTrainingReadiness;
    } catch (err) {
      console.warn(`[GarminClient] Training Readiness not available for ${date}:`, (err as Error).message);
      return [];
    }
  }

  async getActivities(start: number, limit: number): Promise<GarminActivity[]> {
    await this.rateLimit();
    const data = await this.gc.getActivities(start, limit);
    return (Array.isArray(data) ? data : []) as unknown as GarminActivity[];
  }

  async getActivityDetails(activityId: number): Promise<GarminActivityDetails> {
    await this.rateLimit();
    try {
      const details = await (this.gc as unknown as { get: (url: string) => Promise<unknown> }).get(
        `https://connectapi.garmin.com/activity-service/activity/${activityId}/details?maxChartSize=2000&maxPolylineSize=2000`
      );
      return details as GarminActivityDetails;
    } catch {
      return {};
    }
  }

  async getActivitySplits(activityId: number): Promise<GarminActivitySplits> {
    await this.rateLimit();
    try {
      const splits = await (this.gc as unknown as { get: (url: string) => Promise<unknown> }).get(
        `https://connectapi.garmin.com/activity-service/activity/${activityId}/splits`
      );
      return splits as GarminActivitySplits;
    } catch {
      return {};
    }
  }

  async getDailyHeartRate(date: string): Promise<GarminDailyHeartRate> {
    await this.rateLimit();
    try {
      const data = await this.gc.getHeartRate(new Date(date));
      return data as unknown as GarminDailyHeartRate;
    } catch {
      return { calendarDate: date };
    }
  }
}
