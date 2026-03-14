import { google } from 'googleapis';
import type { CalendarEventData, GoogleTokens } from './types';
import { parseGoogleEvent } from './parsers';

export class CalendarClient {
  constructor(
    private readonly tokens: GoogleTokens,
    private readonly source: string,
  ) {}

  private getOAuthClient() {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oAuth2Client.setCredentials({
      access_token: this.tokens.accessToken,
      refresh_token: this.tokens.refreshToken,
      expiry_date: this.tokens.expiresAt,
    });
    return oAuth2Client;
  }

  async getEvents(
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<CalendarEventData[]> {
    const auth = this.getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const items = response.data.items ?? [];
    return items
      .map((item) => parseGoogleEvent(item, this.source, calendarId))
      .filter((e): e is CalendarEventData => e !== null);
  }

  async listCalendars(): Promise<Array<{ id: string; summary: string }>> {
    const auth = this.getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.calendarList.list();
    return (response.data.items ?? [])
      .filter((c) => c.id && c.summary)
      .map((c) => ({ id: c.id!, summary: c.summary! }));
  }

  static async refreshTokens(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
  ): Promise<GoogleTokens> {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oAuth2Client.refreshAccessToken();
    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token ?? refreshToken,
      expiresAt: credentials.expiry_date ?? Date.now() + 3600_000,
    };
  }
}
