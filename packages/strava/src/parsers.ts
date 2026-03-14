import type { StravaActivity } from './types';

const SPORT_MAP: Record<string, string> = {
  Run: 'RUN',
  TrailRun: 'RUN',
  VirtualRun: 'RUN',
  Ride: 'BIKE',
  VirtualRide: 'BIKE',
  MountainBikeRide: 'BIKE',
  GravelRide: 'BIKE',
  Swim: 'SWIM',
  Triathlon: 'TRIATHLON',
  WeightTraining: 'STRENGTH',
  Workout: 'OTHER',
  Walk: 'OTHER',
  Hike: 'OTHER',
};

export function parseStravaSport(sportType: string): string {
  return SPORT_MAP[sportType] ?? 'OTHER';
}

export function parseStravaActivity(activity: StravaActivity) {
  const sport = parseStravaSport(activity.sport_type ?? activity.type);

  // average_speed is in m/s, convert to sec/km for runs
  let avgPace: number | null = null;
  if (activity.average_speed && activity.average_speed > 0 && sport === 'RUN') {
    avgPace = 1000 / activity.average_speed; // sec/km
  }

  return {
    source: 'STRAVA' as const,
    externalId: String(activity.id),
    sport,
    name: activity.name ?? null,
    date: new Date(activity.start_date_local),
    duration: activity.elapsed_time,
    distance: activity.distance ?? null,
    avgHR: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    maxHR: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
    avgPace,
    avgPower: activity.average_watts ? Math.round(activity.average_watts) : null,
    normalizedPower: activity.weighted_average_watts
      ? Math.round(activity.weighted_average_watts)
      : null,
    trainingLoad: activity.suffer_score ?? null,
    elevationGain: activity.total_elevation_gain ?? null,
    avgCadence: activity.average_cadence ? Math.round(activity.average_cadence) : null,
    laps: (activity.laps ?? null) as unknown as Record<string, unknown>[] | null,
    rawData: activity as unknown as Record<string, unknown>,
  };
}
