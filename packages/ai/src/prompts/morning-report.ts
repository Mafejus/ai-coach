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
  plan: {
    plan: unknown;
  } | null;
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

## ZDRAVOTNÍ DATA (POSLEDNÍ DOSTUPNÁ - ${input.health?.date ?? 'neznámo'})
${JSON.stringify(input.health, null, 2)}
BodyBatteryChange je "Body Recovery" - kolik se tělo přes noc dobilo.

## HISTORIE TRÉNINKŮ (POSLEDNÍCH 7 DNÍ)
${JSON.stringify(input.history, null, 2)}

## DNEŠNÍ PLÁN TRÉNINKU
${JSON.stringify(input.plan, null, 2)}

## DNEŠNÍ KALENDÁŘ
${JSON.stringify(input.calendar, null, 2)}

## AKTIVNÍ ZRANĚNÍ
${JSON.stringify(input.injuries, null, 2)}

## NADCHÁZEJÍCÍ ZÁVODY
${JSON.stringify(input.events, null, 2)}

Při tvorbě briefingu:
1. Zohledni únavu z předchozích dní (historie tréninků).
2. Pokud je Body Recovery (BodyBatteryChange) nízké, buď opatrnější v intenzitě.
3. Pokud chybí data pro dnešek, upozorni na to a vycházej z posledních dostupných.
4. Buď stručný, motivující a věcný.
`.trim();
}
