export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  athleteId: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  distance: number; // meters
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number; // m/s
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  total_elevation_gain?: number;
  average_cadence?: number;
  suffer_score?: number;
  laps?: StravaLap[];
}

export interface StravaLap {
  id: number;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  average_speed?: number;
  average_heartrate?: number;
  average_watts?: number;
  lap_index: number;
}

export interface StravaWebhookEvent {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, string>;
}

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  city?: string;
  country?: string;
}
