import { Sport, WorkoutType, TrainingPhase } from './sport';

export interface WorkoutStep {
  type: 'warmup' | 'work' | 'rest' | 'cooldown';
  duration?: number; // seconds
  distance?: number; // meters
  targetHR?: { min: number; max: number };
  targetPace?: { min: number; max: number }; // sec/km
  targetPower?: { min: number; max: number }; // watts
  repeat?: number;
}

export interface PlannedWorkout {
  id: string;
  sport: Sport;
  workoutType: WorkoutType;
  title: string;
  description: string;
  duration: number; // minutes
  distance?: number; // km
  intensity: 'easy' | 'moderate' | 'hard' | 'max';
  structure?: WorkoutStep[];
  completed: boolean;
  actualActivityId?: string;
}

export interface DayPlan {
  date: string; // ISO date
  dayOfWeek: string;
  workouts: PlannedWorkout[];
  isRestDay: boolean;
  notes?: string;
}

export interface WeeklyPlan {
  weekStart: string; // ISO date
  phase: TrainingPhase;
  focus: string;
  totalHours: number;
  totalTSS: number;
  days: DayPlan[];
}

export interface HRZones {
  z1: { min: number; max: number }; // Recovery
  z2: { min: number; max: number }; // Aerobic
  z3: { min: number; max: number }; // Tempo
  z4: { min: number; max: number }; // Threshold
  z5: { min: number; max: number }; // VO2max
}

export interface PaceZones {
  z1: { min: number; max: number }; // sec/km
  z2: { min: number; max: number };
  z3: { min: number; max: number };
  z4: { min: number; max: number };
  z5: { min: number; max: number };
}

export interface PowerZones {
  z1: { min: number; max: number }; // watts
  z2: { min: number; max: number };
  z3: { min: number; max: number };
  z4: { min: number; max: number };
  z5: { min: number; max: number };
  z6: { min: number; max: number };
  z7: { min: number; max: number };
}

export interface TrainingZones {
  hr: HRZones;
  pace?: PaceZones;
  power?: PowerZones;
}
