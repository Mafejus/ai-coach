// Session management for Garmin Connect unofficial API
// Note: Garmin uses session cookies, not OAuth2

export interface GarminSession {
  cookies: Record<string, string>;
  expiresAt: Date;
}

export function isSessionExpired(session: GarminSession): boolean {
  return new Date() >= session.expiresAt;
}

export function parseSessionFromResponse(_headers: Headers): GarminSession | null {
  // TODO: Parse session cookies from Garmin Connect response
  return null;
}
