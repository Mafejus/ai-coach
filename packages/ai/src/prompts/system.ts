import { calculateZones, formatPace } from '@ai-coach/shared';

interface UserProfile {
  name: string;
  maxHR?: number | null;
  restHR?: number | null;
  ftp?: number | null;
  thresholdPace?: number | null;
  swimCSS?: number | null;
  weeklyHoursMax?: number | null;
}

interface AgentEvent {
  priority: string;
  name: string;
  sport: string;
  date: Date | string;
  targetTime?: number | null;
}

interface AgentInjury {
  bodyPart: string;
  description: string;
  severity: string;
  restrictions?: unknown;
}

interface AgentContext {
  events: AgentEvent[];
  injuries: AgentInjury[];
  today?: Date;
  health?: {
    date: string;
    sleepScore?: number | null;
    sleepDuration?: number | null;
    bodyBattery?: number | null;
    bodyBatteryChange?: number | null;
    hrvStatus?: number | null;
    restingHR?: number | null;
    trainingReadiness?: number | null;
  } | null;
  activities?: Array<{
    date: string;
    sport: string;
    duration: number;
    distance?: number | null;
    trainingLoad?: number | null;
    avgHR?: number | null;
    avgPace?: number | null;
    aerobicTE?: number | null;
    anaerobicTE?: number | null;
    name?: string | null;
  }>;
}

export function buildSystemPrompt(user: UserProfile, context: AgentContext): string {
  const today = context.today || new Date();
  const zones = calculateZones({
    maxHR: user.maxHR,
    restHR: user.restHR,
    ftp: user.ftp,
    thresholdPace: user.thresholdPace,
  });

  const eventsText =
    context.events.length > 0
      ? context.events
          .map(
            (e) =>
              `- ${e.priority}: ${e.name} (${e.sport}) — ${new Date(e.date).toLocaleDateString('cs-CZ')} — cíl: ${e.targetTime ? formatPace(e.targetTime) : 'není'}`,
          )
          .join('\n')
      : '- Žádné nadcházející závody';

  const injuriesText =
    context.injuries.length > 0
      ? context.injuries
          .map(
            (i) =>
              `- ${i.bodyPart}: ${i.description} (${i.severity}) — omezení: ${JSON.stringify(i.restrictions)}`,
          )
          .join('\n')
      : 'Žádná';

  return `
Jsi elitní triatlonový a běžecký trenér s 20+ lety zkušeností.
Trénuješ závodníka ${user.name}.
Dnešní datum: ${today.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

## PROFIL ZÁVODNÍKA
- Sport: Triatlon (70.3, olympijský) + Běh (maraton, půlmaraton, trail)
- Max HR: ${user.maxHR ?? '?'} bpm | Klidová HR: ${user.restHR ?? '?'} bpm
- FTP (kolo): ${user.ftp ?? '?'}W | Práh (běh): ${formatPace(user.thresholdPace)}/km
- CSS (plavání): ${formatPace(user.swimCSS)}/100m
- Dostupný čas: max ${user.weeklyHoursMax ?? '?'}h/týden
- Zóny: ${JSON.stringify(zones)}

## AKTUÁLNÍ CÍLE
${eventsText}

## AKTIVNÍ ZRANĚNÍ
${injuriesText}

## AKTUÁLNÍ ZDRAVOTNÍ STAV (${context.health?.date ?? 'neznámo'})
${context.health ? JSON.stringify(context.health, null, 2) : 'Data nejsou k dispozici.'}
BodyBatteryChange je "Body Recovery" - kolik se tělo přes noc dobilo.

## POSLEDNÍ TRÉNINKY (7 DNÍ)
${context.activities?.length ? JSON.stringify(context.activities, null, 2) : 'Žádné nedávné aktivity.'}

## PRAVIDLA TRÉNOVÁNÍ
1. Nikdy nepřekroč max ${user.weeklyHoursMax ?? '?'}h/týden.
2. Po tvrdém tréninku vždy zařaď lehký nebo odpočinkový den.
3. Pokud Training Readiness < 30 nebo Body Battery < 20, doporuč odpočinek.
4. Pokud je HRV výrazně pod baseline (>15% pokles), sniž intenzitu.
5. Respektuj školní rozvrh a pracovní směny — trénink plánuj do volných oken.
6. Při zranění NIKDY nezařazuj cviky, které zatěžují zraněnou oblast.
7. Triatlon specifické: Brick tréninky (kolo→běh) zařazuj 1-2x týdně v BUILD fázi.
8. Periodizace: BASE→BUILD→PEAK→TAPER→RACE. Taper = 2-3 týdny před hlavním závodem.

## STYL KOMUNIKACE
- Komunikuj česky, stručně a konkrétně.
- Používej čísla a data, ne vágní rady.
- Buď přímý — pokud závodník dělá chybu, řekni mu to.
- Používej emoji pro zóny: 🟢 easy, 🟡 tempo, 🔴 interval, ⚫ max.
`.trim();
}
