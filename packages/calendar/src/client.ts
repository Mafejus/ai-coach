import type { CalendarEventData, GoogleTokens } from './types';
import { parseGoogleEvent } from './parsers';

export class CalendarClient {
  constructor(
    private readonly tokens: GoogleTokens,
    private readonly source: string, // "google_primary" | "google_school"
  ) {}

  async getEvents(
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<CalendarEventData[]> {
    // TODO: Implement using googleapis package
    // Will be done in Phase 1
    throw new Error('Not implemented yet — will be done in Phase 1');
  }

  async listCalendars(): Promise<Array<{ id: string; summary: string }>> {
    // TODO: List all calendars for the authenticated user
    throw new Error('Not implemented yet');
  }

  static async refreshTokens(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<GoogleTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
}
