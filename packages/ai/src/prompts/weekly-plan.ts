interface WeeklyPlanInput {
  user: {
    name: string;
    weeklyHoursMax?: number | null;
  };
  targetEvent?: {
    name: string;
    date: Date | string;
    daysUntil: number;
    phase: string;
  } | null;
  lastWeekSummary: {
    totalHours: number;
    compliance: number;
    sports: Record<string, number>;
  } | null;
  calendar: Array<{
    date: string;
    busySlots: Array<{ start: string; end: string; title: string }>;
  }>;
  injuries: Array<{
    bodyPart: string;
    severity: string;
    restrictions: unknown;
  }>;
}

export function weeklyPlanPrompt(input: WeeklyPlanInput): string {
  // TODO: Build structured weekly plan generation prompt
  return `
Vygeneruj týdenní tréninkový plán pro ${input.user.name}.

## KONTEXT
- Max hodin/týden: ${input.user.weeklyHoursMax ?? '?'}
- Cílový závod: ${JSON.stringify(input.targetEvent)}
- Minulý týden: ${JSON.stringify(input.lastWeekSummary)}

## KALENDÁŘ NA PŘÍŠTÍ TÝDEN
${JSON.stringify(input.calendar, null, 2)}

## AKTIVNÍ ZRANĚNÍ
${JSON.stringify(input.injuries, null, 2)}

Vygeneruj týdenní plán ve formátu WeeklyPlan JSON. Každý den musí mít datum, tréninky s detailním popisem, zóny a strukturu.
`.trim();
}
