export enum Sport {
  RUN = 'RUN',
  BIKE = 'BIKE',
  SWIM = 'SWIM',
  TRIATHLON = 'TRIATHLON',
  STRENGTH = 'STRENGTH',
  OTHER = 'OTHER',
}

export enum EventPriority {
  MAIN = 'MAIN',
  SECONDARY = 'SECONDARY',
  TRAINING = 'TRAINING',
}

export enum WorkoutType {
  EASY = 'EASY',
  TEMPO = 'TEMPO',
  INTERVAL = 'INTERVAL',
  LONG_RUN = 'LONG_RUN',
  RECOVERY = 'RECOVERY',
  RACE_PACE = 'RACE_PACE',
  BRICK = 'BRICK',
  OPEN_WATER = 'OPEN_WATER',
  STRENGTH = 'STRENGTH',
  REST = 'REST',
}

export type TrainingPhase = 'BASE' | 'BUILD' | 'PEAK' | 'TAPER' | 'RECOVERY';

export enum DataSource {
  GARMIN = 'GARMIN',
  STRAVA = 'STRAVA',
  MANUAL = 'MANUAL',
}

export enum PlanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ADJUSTED = 'ADJUSTED',
  COMPLETED = 'COMPLETED',
}

export enum InjurySeverity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}
