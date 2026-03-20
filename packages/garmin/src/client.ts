// Garmin Connect client using garmin-connect npm package
// ⚠️ Unofficial API — may break at any time
// Rate limit: max 1 request / 2 seconds

import { GarminConnect } from 'garmin-connect';
// @ts-ignore
import { HttpsProxyAgent } from 'https-proxy-agent';
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

/**
 * Build proxy URL with ScraperAPI sticky session support.
 * Transforms: http://scraperapi:KEY@proxy-server.scraperapi.com:8001
 *        To:  http://scraperapi.session_number=XXXXX:KEY@proxy-server.scraperapi.com:8001
 *
 * Sticky sessions keep the same IP across all requests in the session.
 * This is REQUIRED for Garmin SSO (multi-step auth flow needs same IP).
 * Sessions expire after 15 minutes of inactivity (ScraperAPI docs).
 */
function buildProxyUrl(): string | null {
  const proxyUrl = process.env.SCRAPERAPI_PROXY_URL || process.env.GARMIN_PROXY_URL;
  if (!proxyUrl) return null;

  // If already has session_number, use as-is
  if (proxyUrl.includes('session_number')) return proxyUrl;

  // Inject session_number into ScraperAPI proxy URL
  try {
    const url = new URL(proxyUrl);
    if (url.hostname.includes('scraperapi')) {
      // Random session ID per client instance — keeps same IP for entire auth + data cycle
      const sessionId = Math.floor(Math.random() * 1_000_000);
      const currentUser = url.username || 'scraperapi';
      url.username = `${currentUser}.session_number=${sessionId}`;
      console.log(`[GarminClient] Using sticky session #${sessionId}`);
      return url.toString();
    }
  } catch {
    // URL parsing failed, use as-is
  }

  return proxyUrl;
}

/**
 * Inject proxy agent into garmin-connect's internal HTTP client.
 * garmin-connect uses axios internally but the path to the client varies.
 * We try multiple known paths and fall back to axios global defaults.
 */
function injectProxy(gc: GarminConnect, proxyUrl: string): boolean {
  const agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false });

  // Try multiple internal paths (garmin-connect v1.6.x)
  const candidates = [
    (gc as any).client?.client,  // most common: gc.client.client (HttpClient.client = AxiosInstance)
    (gc as any).client,           // some versions expose axios directly
    (gc as any)._client,          // alternative
  ];

  for (const axiosInstance of candidates) {
    if (axiosInstance?.defaults) {
      axiosInstance.defaults.httpsAgent = agent;
      axiosInstance.defaults.httpAgent = agent;
      axiosInstance.defaults.proxy = false; // Don't use axios built-in proxy, use agent instead
      console.log('[GarminClient] Proxy agent injected successfully');
      return true;
    }
  }

  // Fallback: set on axios global defaults (affects ALL axios requests in process)
  console.warn('[GarminClient] Internal client not found, trying axios global defaults');
  try {
    const axios = require('axios');
    axios.defaults.httpsAgent = agent;
    axios.defaults.httpAgent = agent;
    axios.defaults.proxy = false;
    console.log('[GarminClient] Proxy set via axios global defaults (fallback)');
    return true;
  } catch (e) {
    console.error('[GarminClient] FAILED to inject proxy anywhere:', e);
    return false;
  }
}

export interface GarminClientOptions {
  /** Previously saved session JSON string (from DB) */
  savedSession?: string | null;
  /** Called when session changes — use to persist to DB */
  onSessionChange?: (sessionJson: string) => void | Promise<void>;
}

export class GarminClient {
  private gc: GarminConnect;
  private lastRequestAt = 0;
  private displayName: string | null = null;
  private proxyUrl: string | null;
  private savedSessionJson: string | null = null;
  private onSessionChangeCb?: (sessionJson: string) => void | Promise<void>;

  constructor(
    private readonly email: string,
    private readonly password: string,
    options?: GarminClientOptions,
  ) {
    this.gc = new GarminConnect({ username: email, password });
    this.proxyUrl = buildProxyUrl();
    this.savedSessionJson = options?.savedSession ?? null;
    this.onSessionChangeCb = options?.onSessionChange;

    // Listen for session changes to persist them
    if (this.onSessionChangeCb) {
      (this.gc as any).onSessionChange(async (session: unknown) => {
        try {
          const json = JSON.stringify(session);
          this.savedSessionJson = json;
          await this.onSessionChangeCb?.(json);
        } catch (e) {
          console.error('[GarminClient] Failed to persist session change:', e);
        }
      });
    }
  }

  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < RATE_LIMIT_MS) {
      await sleep(RATE_LIMIT_MS - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * Authenticate with Garmin Connect.
   * 1. Inject proxy BEFORE any HTTP call
   * 2. Try restoring saved session (avoids SSO entirely)
   * 3. Fall back to full login if session restore fails
   * 4. Re-inject proxy AFTER login (login may recreate internal HTTP client)
   */
  async authenticate(): Promise<void> {
    // STEP 1: Inject proxy BEFORE any HTTP calls happen
    if (this.proxyUrl) {
      console.log('[GarminClient] Using proxy from environment');
      injectProxy(this.gc, this.proxyUrl);
    }

    // STEP 2: Try session restore first (skips SSO flow entirely)
    let loginDone = false;
    if (this.savedSessionJson) {
      try {
        console.log('[GarminClient] Attempting session restore...');
        const savedSession = JSON.parse(this.savedSessionJson);
        // restoreOrLogin tries to restore, falls back to login() if it fails
        await (this.gc as any).restoreOrLogin(savedSession, this.email, this.password);
        console.log('[GarminClient] Session restored or re-logged successfully');
        loginDone = true;
      } catch (e) {
        console.warn('[GarminClient] restoreOrLogin failed:', (e as Error).message);
        // Will fall through to manual login below
      }
    }

    // STEP 3: Full login if no session or restore failed
    if (!loginDone) {
      console.log('[GarminClient] Doing full SSO login...');
      await this.gc.login(this.email, this.password);
      console.log('[GarminClient] Full login successful');
    }

    // STEP 4: Re-inject proxy AFTER login (login may recreate HTTP client internally)
    if (this.proxyUrl) {
      injectProxy(this.gc, this.proxyUrl);
    }

    // Get display name (needed for some API endpoints)
    try {
      const profile = await (this.gc as unknown as { getUserProfile: () => Promise<{ displayName: string }> }).getUserProfile();
      this.displayName = profile?.displayName ?? null;
      console.log('[GarminClient] Authenticated, displayName:', this.displayName);
    } catch {
      console.warn('[GarminClient] Could not fetch display name after login');
    }
  }

  /**
   * Get current session JSON for persistence to DB.
   */
  getSessionJson(): string | null {
    try {
      const session = (this.gc as any).sessionJson;
      if (session) return JSON.stringify(session);
    } catch { /* ignore */ }
    return this.savedSessionJson;
  }

  // ─── Existing public API methods — signatures unchanged ─────────

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
