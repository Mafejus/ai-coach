// Garmin Connect client - uses unofficial API
// ⚠️ This is an unofficial API and may break at any time
// Rate limit: max 1 request/2 seconds

import type { GarminSleepData, GarminHeartRateData, GarminHRVData, GarminUserSummary, GarminActivity } from './types';

export class GarminClient {
  private baseUrl = 'https://connect.garmin.com';
  private cookies: Record<string, string> = {};

  constructor(private readonly email: string, private readonly password: string) {}

  async authenticate(): Promise<void> {
    // TODO: Implement Garmin SSO authentication
    // Uses garmin-connect npm package or direct SSO flow
    throw new Error('Not implemented yet — will be done in Phase 1');
  }

  async getSleepData(_date: string): Promise<GarminSleepData> {
    // TODO: GET /wellness-service/wellness/dailySleepData/{date}
    throw new Error('Not implemented yet');
  }

  async getHeartRate(_date: string): Promise<GarminHeartRateData> {
    // TODO: GET /wellness-service/wellness/dailyHeartRate/{date}
    throw new Error('Not implemented yet');
  }

  async getHRVData(_date: string): Promise<GarminHRVData> {
    // TODO: GET /hrv-service/hrv/{date}
    throw new Error('Not implemented yet');
  }

  async getUserSummary(_date: string): Promise<GarminUserSummary> {
    // TODO: GET /usersummary-service/usersummary/daily/{date}
    throw new Error('Not implemented yet');
  }

  async getActivities(_start: number, _limit: number): Promise<GarminActivity[]> {
    // TODO: GET /activitylist-service/activities/search/activities
    throw new Error('Not implemented yet');
  }

  private async request<T>(_path: string): Promise<T> {
    // TODO: Implement authenticated HTTP request with cookie management
    throw new Error('Not implemented yet');
  }
}
