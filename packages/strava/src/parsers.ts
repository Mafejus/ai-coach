import type { StravaActivity } from './types';

export function parseStravaSport(sportType: string): string {
  const mapping: Record<string, string> = {
    Run: 'RUN',
    TrailRun: 'RUN',
    VirtualRun: 'RUN',
    Ride: 'BIKE',
    VirtualRide: 'BIKE',
    MountainBikeRide: 'BIKE',
    Swim: 'SWIM',
    Triathlon: 'TRIATHLON',
    WeightTraining: 'STRENGTH',
    Workout: 'OTHER',
  };
  return mapping[sportType] ?? 'OTHER';
}

export function parseStravaActivity(activity: StravaActivity) {
  return {
    externalId: String(activity.id),
    name: activity.name,
    date: new Date(activity.start_date_local),
    duration: activity.elapsed_time,
    distance: activity.distance,
    avgHR: activity.average_heartrate ? Math.round(activity.average_heartrate) : undefined,
    maxHR: activity.max_heartrate ? Math.round(activity.max_heartrate) : undefined,
    avgPower: activity.average_watts ? Math.round(activity.average_watts) : undefined,
    normalizedPower: activity.weighted_average_watts
      ? Math.round(activity.weighted_average_watts)
      : undefined,
    trainingLoad: activity.suffer_score,
    elevationGain: activity.total_elevation_gain,
    avgCadence: activity.average_cadence ? Math.round(activity.average_cadence) : undefined,
    sport: parseStravaSport(activity.sport_type),
    laps: activity.laps,
    rawData: activity,
  };
}
