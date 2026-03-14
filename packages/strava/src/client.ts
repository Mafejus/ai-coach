import type { StravaActivity, StravaTokens, StravaAthlete } from './types';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

export class StravaClient {
  constructor(private tokens: StravaTokens) {}

  async getActivities(after: number, perPage = 30): Promise<StravaActivity[]> {
    return this.get<StravaActivity[]>(
      `/athlete/activities?after=${after}&per_page=${perPage}`,
    );
  }

  async getDetailedActivity(activityId: number): Promise<StravaActivity> {
    return this.get<StravaActivity>(`/activities/${activityId}`);
  }

  async getAthlete(): Promise<StravaAthlete> {
    return this.get<StravaAthlete>('/athlete');
  }

  static async exchangeCode(
    clientId: string,
    clientSecret: string,
    code: string,
  ): Promise<StravaTokens> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) throw new Error('Strava code exchange failed');
    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
      athlete: { id: number };
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at * 1000,
      athleteId: data.athlete.id,
    };
  }

  static async refreshTokens(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<Pick<StravaTokens, 'accessToken' | 'refreshToken' | 'expiresAt'>> {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    if (!response.ok) throw new Error(`Strava token refresh failed: ${response.statusText}`);
    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at * 1000,
    };
  }

  isTokenExpired(): boolean {
    return Date.now() >= this.tokens.expiresAt - 300_000; // 5 min buffer
  }

  private async get<T>(path: string, retries = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const response = await fetch(`${STRAVA_API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${this.tokens.accessToken}` },
      });

      if (response.status === 429) {
        // Rate limited — exponential backoff
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
        console.warn(`[strava] Rate limited, waiting ${retryAfter}s (attempt ${attempt})`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Strava API error: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    }
    throw new Error('Strava API: max retries exceeded');
  }
}
