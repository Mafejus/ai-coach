export interface CalendarEventData {
  externalId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
  calendarId: string;
  source: string; // "google_primary" | "google_school"
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
}

export interface CalendarConfig {
  calendarId: string;
  source: string;
  tokens: GoogleTokens;
}

export type EventCategory = 'school' | 'work' | 'personal' | 'sport' | 'other';
