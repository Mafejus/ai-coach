interface MorningReportInput {
  health: {
    sleepScore?: number | null;
    sleepDuration?: number | null;
    bodyBattery?: number | null;
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
  yesterday: {
    sport: string;
    duration: number;
    distance?: number | null;
    name?: string | null;
  } | null;
}

export function morningReportPrompt(input: MorningReportInput): string {
  // TODO: Build structured morning report prompt
  return `
Vygeneruj ranní tréninkový briefing pro dnešní den.

## ZDRAVOTNÍ DATA Z MINULÉ NOCI
${JSON.stringify(input.health, null, 2)}

## DNEŠNÍ PLÁN TRÉNINKU
${JSON.stringify(input.plan, null, 2)}

## DNEŠNÍ KALENDÁŘ
${JSON.stringify(input.calendar, null, 2)}

## AKTIVNÍ ZRANĚNÍ
${JSON.stringify(input.injuries, null, 2)}

## VČEREJŠÍ AKTIVITA
${JSON.stringify(input.yesterday, null, 2)}

## NADCHÁZEJÍCÍ ZÁVODY
${JSON.stringify(input.events, null, 2)}

Vygeneruj strukturovaný briefing v češtině. Zahrň:
1. Celkové hodnocení dnešní formy (na základě spánku, HRV, Body Battery)
2. Doporučení pro dnešní trénink (upravit/potvrdit/přeskočit)
3. Varování z kalendáře (čas na trénink)
4. Rychlý pohled na závody (odpočet)
`.trim();
}
