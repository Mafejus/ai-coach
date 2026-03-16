export type TrainingPhase = 'BASE' | 'BUILD' | 'PEAK' | 'TAPER' | 'RACE' | 'RECOVERY';

export interface PeriodPhase {
  phase: TrainingPhase;
  startDate: string; // ISO
  endDate: string;   // ISO
  weeks: number;
  focus: string;
  weeklyHoursRange: { min: number; max: number };
  intensityDistribution: { easy: number; moderate: number; hard: number };
}

export interface PeriodizationPlan {
  phases: PeriodPhase[];
  currentPhase: TrainingPhase;
  currentWeek: number;
  totalWeeks: number;
  mainEventDate: string | null;
}

const PHASE_FOCUS: Record<TrainingPhase, string> = {
  BASE: 'Budování aerobní základny a síly',
  BUILD: 'Zvyšování intenzity a specifický trénink',
  PEAK: 'Vrcholová příprava a simulace závodu',
  TAPER: 'Snižování objemu, udržení rychlosti',
  RACE: 'Závodní týden',
  RECOVERY: 'Aktivní regenerace po závodě',
};

const PHASE_INTENSITY: Record<TrainingPhase, { easy: number; moderate: number; hard: number }> = {
  BASE:     { easy: 80, moderate: 15, hard: 5 },
  BUILD:    { easy: 65, moderate: 20, hard: 15 },
  PEAK:     { easy: 55, moderate: 20, hard: 25 },
  TAPER:    { easy: 70, moderate: 20, hard: 10 },
  RACE:     { easy: 80, moderate: 10, hard: 10 },
  RECOVERY: { easy: 95, moderate: 5, hard: 0 },
};

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export function computePeriodization(
  mainEventDate: Date | null,
  maxWeeklyHours: number = 10,
): PeriodizationPlan {
  const now = new Date();

  if (!mainEventDate || mainEventDate <= now) {
    return {
      phases: [],
      currentPhase: 'BASE',
      currentWeek: 1,
      totalWeeks: 0,
      mainEventDate: mainEventDate ? toISO(mainEventDate) : null,
    };
  }

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const totalWeeks = Math.ceil((mainEventDate.getTime() - now.getTime()) / msPerWeek);

  let phaseDefs: { phase: TrainingPhase; weeks: number }[];

  if (totalWeeks <= 6) {
    const taperWeeks = Math.min(2, totalWeeks - 1);
    phaseDefs = ([
      { phase: 'BUILD' as TrainingPhase, weeks: totalWeeks - taperWeeks - 1 },
      { phase: 'TAPER' as TrainingPhase, weeks: taperWeeks },
      { phase: 'RACE' as TrainingPhase, weeks: 1 },
    ] as { phase: TrainingPhase; weeks: number }[]).filter(p => p.weeks > 0);
  } else if (totalWeeks <= 12) {
    phaseDefs = [
      { phase: 'BASE', weeks: Math.round(totalWeeks * 0.30) },
      { phase: 'BUILD', weeks: Math.round(totalWeeks * 0.40) },
      { phase: 'PEAK', weeks: Math.round(totalWeeks * 0.15) },
      { phase: 'TAPER', weeks: Math.max(2, Math.round(totalWeeks * 0.15)) },
      { phase: 'RACE', weeks: 1 },
    ];
  } else if (totalWeeks <= 20) {
    phaseDefs = [
      { phase: 'BASE', weeks: Math.round(totalWeeks * 0.35) },
      { phase: 'BUILD', weeks: Math.round(totalWeeks * 0.30) },
      { phase: 'PEAK', weeks: Math.round(totalWeeks * 0.15) },
      { phase: 'TAPER', weeks: Math.max(2, Math.round(totalWeeks * 0.10)) },
      { phase: 'RACE', weeks: 1 },
    ];
  } else {
    phaseDefs = [
      { phase: 'BASE', weeks: Math.round(totalWeeks * 0.40) },
      { phase: 'BUILD', weeks: Math.round(totalWeeks * 0.25) },
      { phase: 'PEAK', weeks: Math.round(totalWeeks * 0.15) },
      { phase: 'TAPER', weeks: Math.max(2, Math.round(totalWeeks * 0.10)) },
      { phase: 'RACE', weeks: 1 },
    ];
  }

  // Build phases with dates
  const phases: PeriodPhase[] = [];
  let cursor = new Date(now);

  for (const def of phaseDefs) {
    if (def.weeks <= 0) continue;
    const start = new Date(cursor);
    const end = addWeeks(cursor, def.weeks);

    const volumeMultiplier: Record<TrainingPhase, number> = {
      BASE: 0.70, BUILD: 0.85, PEAK: 1.0, TAPER: 0.60, RACE: 0.30, RECOVERY: 0.40,
    };
    const mult = volumeMultiplier[def.phase];

    phases.push({
      phase: def.phase,
      startDate: toISO(start),
      endDate: toISO(end),
      weeks: def.weeks,
      focus: PHASE_FOCUS[def.phase],
      weeklyHoursRange: {
        min: Math.round(maxWeeklyHours * mult * 0.8 * 10) / 10,
        max: Math.round(maxWeeklyHours * mult * 10) / 10,
      },
      intensityDistribution: PHASE_INTENSITY[def.phase],
    });

    cursor = end;
  }

  // Determine current phase
  const nowISO = toISO(now);
  let currentPhase: TrainingPhase = phases[0]?.phase ?? 'BASE';
  let currentWeek = 1;

  for (const p of phases) {
    if (nowISO >= p.startDate && nowISO < p.endDate) {
      currentPhase = p.phase;
      const weeksIn = Math.floor((now.getTime() - new Date(p.startDate).getTime()) / msPerWeek) + 1;
      currentWeek = Math.min(weeksIn, p.weeks);
      break;
    }
  }

  return { phases, currentPhase, currentWeek, totalWeeks, mainEventDate: toISO(mainEventDate) };
}

export function getCurrentPhaseInfo(plan: PeriodizationPlan): PeriodPhase | null {
  return plan.phases.find(p => p.phase === plan.currentPhase) ?? null;
}
