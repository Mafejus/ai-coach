interface MorningReportInput {
  health: {
    date?: string;
    sleepScore?: number | null;
    sleepDuration?: number | null;
    bodyBattery?: number | null;
    bodyBatteryChange?: number | null;
    hrvStatus?: number | null;
    hrvBaseline?: number | null;
    trainingReadiness?: number | null;
    restingHR?: number | null;
  } | null;
  coachContext: {
    directives: string;
    focusAreas: string[];
    recoveryStatus: string;
    overtrainingRisk: string;
  } | null;
  plannedWorkouts: Array<{
    date: string;
    title: string;
    type: string;
    duration: number;
    description: string;
    isRestDay: boolean;
  }>;
  calendar: Array<{
    title: string;
    startTime: Date | string;
    endTime: Date | string;
    category?: string | null;
  }>;
  injuries: Array<{
    bodyPart: string;
    severity: string;
    description: string;
  }>;
  events: Array<{
    name: string;
    date: Date | string;
    daysUntil?: number;
  }>;
  history: Array<{
    date: string;
    sport: string;
    duration: number;
    distance?: number | null;
    name?: string | null;
    trainingLoad?: number | null;
    aerobicTE?: number | null;
    anaerobicTE?: number | null;
  }>;
}

export function morningReportPrompt(input: MorningReportInput): string {
  return `
Vygeneruj ranní tréninkový briefing v češtině.
Dnešní datum: ${new Date().toLocaleDateString('cs-CZ')}

## HLAVNÍ DIREKTIVY OD TRENÉRA (AI COACH)
${input.coachContext ? `
Stav: ${input.coachContext.recoveryStatus} | Riziko: ${input.coachContext.overtrainingRisk}
Fokus: ${input.coachContext.focusAreas.join(', ')}
Direktiva: ${input.coachContext.directives}
` : 'Žádné specifické direktivy.'}

## DNEŠNÍ A NADCHÁZEJÍCÍ TRÉNINKY (PLÁN)
${input.plannedWorkouts.length > 0 
  ? input.plannedWorkouts.map(w => `- ${w.date}: ${w.isRestDay ? 'ODPOČINEK' : `${w.title} (${w.type}, ${w.duration} min)`}`).join('\n')
  : 'Žádný detailní plán nenalezen.'
}

## ZDRAVOTNÍ DATA (POSLEDNÍ DOSTUPNÁ - ${input.health?.date ?? 'neznámo'})
${JSON.stringify(input.health, null, 2)}
BodyBatteryChange je "Body Recovery" - kolik se tělo přes noc dobilo.

## HISTORIE TRÉNINKŮ (POSLEDNÍCH 7 DNÍ)
${JSON.stringify(input.history, null, 2)}

## DNEŠNÍ KALENDÁŘ
${JSON.stringify(input.calendar, null, 2)}

## AKTIVNÍ ZRANĚNÍ
${JSON.stringify(input.injuries, null, 2)}

## NADCHÁZEJÍCÍ ZÁVODY
${JSON.stringify(input.events, null, 2)}

Při tvorbě briefingu:
1. Prioritně se drž "Hlavních direktiv od trenéra" a "Plánu tréninků".
2. Zohledni únavu z předchozích dní a aktuální zdravotní metriky (HRV, Sleep).
3. Pokud je Body Recovery (BodyBatteryChange) nízké, buď opatrnější.
4. Buď stručný, velmi motivující, ale profesionální (jako elitní trenér).
`.trim();
}
