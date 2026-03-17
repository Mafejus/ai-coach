# Claude Code — Urgentní opravy (MUSÍ být všechny opraveny)

Přečti si architecture.md pro kontext. Toto jsou kritické bugy které musíš opravit VŠECHNY.

---

## BUG 1: Kalendář — datum posunuté o 1 den

**Symptom:** Event v Google Calendar na 15.3. se v naší appce zobrazí na 16.3.
**Příčina:** Špatná timezone konverze. Google Calendar vrací časy v UTC nebo v timezone kalendáře, ale při ukládání do DB se pravděpodobně konvertuje špatně.

**Oprav v `packages/calendar/src/parsers.ts`:**
- Pro events S ČASEM (ne celodenní): zachovej přesný čas i s timezone, nekonvertuj na UTC při ukládání
- Pro CELODENNÍ events (isAllDay): Google vrací formát `2026-03-15` (bez času) — ulož jako `2026-03-15T00:00:00` v lokální timezone (Europe/Prague), NESMÍŠ to interpretovat jako UTC
- Celodenní eventy mají v Google API `date` field (ne `dateTime`) — ověř že parser tohle rozlišuje
- Použij `date-fns-tz` nebo manuální offset pro správnou konverzi

**Test:** Po opravě spusť sync kalendáře. Event vytvořený na 15.3. v Google Calendar MUSÍ být na 15.3. v naší appce.

## BUG 2: Kalendář — synchronizuje jen budoucí události a jen 30 dní

**Symptom:** V kalendáři vidím jen budoucí události, chci i minulé.

**Oprav v sync logice (jak v API route `/api/sync/calendar` tak v worker jobu `calendar-sync`):**
- `timeMin` = dnes MINUS 90 dní (3 měsíce zpět)
- `timeMax` = dnes PLUS 90 dní (3 měsíce dopředu)
- Celkem 180 dní
- Ujisti se že Calendar stránka v UI umí zobrazit i minulé týdny (navigace šipkami)

## BUG 3: Garmin health metriky — neúplné, chybí spánek, HRV, Training Readiness

**Symptom:** Na Health stránce vidím jen Body Battery (1 bod), klidovou tepovku a stress (1 bod). Chybí: spánek (sleepScore, sleepDuration, fáze), HRV (hrvStatus, hrvBaseline), Training Readiness.

**Oprav — kompletní přepis Garmin health sync:**

Projdi KAŽDÝ den za posledních 14 dní a pro KAŽDÝ den zavolej:

```typescript
import { GarminConnect } from 'garmin-connect';

const gc = new GarminConnect({ username, password });
await gc.login();

for (const date of last14Days) {
  const dateStr = formatDate(date); // 'YYYY-MM-DD'
  
  // 1. SPÁNEK — toto je KRITICKÉ, teď chybí kompletně
  try {
    const sleepData = await gc.getSleep(dateStr);
    // sleepData obsahuje: dailySleepDTO nebo podobnou strukturu
    // Hledej: overallScore/sleepScores, sleepTimeSeconds, deepSleepSeconds, 
    //         remSleepSeconds, lightSleepSeconds, awakeSleepSeconds
    // POZOR: hodnoty mohou být v sekundách — převeď na minuty
    console.log('Sleep raw:', JSON.stringify(sleepData).substring(0, 500));
  } catch (e) {
    console.error('Sleep fetch failed for', dateStr, e.message);
  }

  // 2. HRV
  try {
    const hrvData = await gc.getHRVData(dateStr);
    // Hledej: hrvSummary, lastNightAvg, weeklyAvg, status
    console.log('HRV raw:', JSON.stringify(hrvData).substring(0, 500));
  } catch (e) {
    console.error('HRV fetch failed for', dateStr, e.message);
  }

  // 3. User Summary (Body Battery, Stress, Resting HR, Training Readiness)
  try {
    const summary = await gc.getUserSummary(dateStr);
    // Hledej: bodyBatteryMostRecentValue, averageStressLevel,
    //         restingHeartRate, trainingReadinessScore
    console.log('Summary raw:', JSON.stringify(summary).substring(0, 500));
  } catch (e) {
    console.error('Summary fetch failed for', dateStr, e.message);
  }

  // 4. Upsert do DB
  await prisma.healthMetric.upsert({
    where: { userId_date: { userId, date: startOfDay(date) } },
    create: { userId, date: startOfDay(date), ...allParsedMetrics },
    update: { ...allParsedMetrics },
  });

  // RATE LIMIT: 2 sekundy mezi requesty na Garmin
  await new Promise(r => setTimeout(r, 2000));
}
```

**DŮLEŽITÉ:** 
- Loguj raw data z Garminu (console.log) abych mohl vidět strukturu a případně debugovat
- Každé API volání obal try/catch — pokud jedna metrika selže, pokračuj s dalšími
- Ulož rawData do JSON pole v health_metrics pro debugging
- Pokud garmin-connect knihovna nemá metodu `getHRVData`, zkus alternativy: `getHRV`, `getHeartRateVariability` apod. Prohlédni si dostupné metody knihovny.

## BUG 4: Garmin sync frekvence — chci automatický sync každých 5 minut

**Symptom:** Data se synchronizují jen manuálně, jednou.

**Oprav v `apps/worker/src/`:**

Worker MUSÍ běžet a MUSÍ mít aktivní cron joby:

```typescript
// apps/worker/src/schedules.ts — ODKOMENTUJ a nastav:

// Quick sync - každých 5 minut (jen dnešní data)
{ name: 'garmin-quick-sync', cron: '*/5 * * * *', data: { mode: 'quick' } }
// Quick = stáhni jen DNEŠNÍ health metriky (1 den, ~3 API cally)

// Calendar sync - každých 15 minut
{ name: 'calendar-sync', cron: '*/15 * * * *' }

// Full Garmin sync - každé 2 hodiny (14 dní historie)
{ name: 'garmin-full-sync', cron: '0 */2 * * *', data: { mode: 'full' } }

// Strava sync - každých 30 minut
{ name: 'strava-sync', cron: '*/30 * * * *' }
```

**Ověř:**
- Worker process startuje v `npx turbo dev` (měl by běžet jako druhý process vedle web)
- Worker se připojí na Redis (localhost:6379)
- Cron joby se registrují při startu (loguj: "Registered cron: garmin-quick-sync */5 * * * *")
- Každý job loguje start a konec ("garmin-quick-sync started", "garmin-quick-sync completed: 5 metrics updated")

## BUG 5: AI Chat nefunguje vůbec

**Symptom:** Chat stránka buď hází chybu, nebo AI neodpovídá.

**Zkontroluj a oprav:**

1. **API route `/api/chat/route.ts` existuje a funguje:**
   - Musí importovat `streamText` z `ai` a `google` z `@ai-sdk/google`
   - Musí číst GOOGLE_AI_API_KEY z env (ne GOOGLE_API_KEY nebo jiný název)
   - Ověř: `process.env.GOOGLE_AI_API_KEY` je nastavený v `.env` i v `apps/web/.env`

2. **Model string musí být správný:**
   ```typescript
   import { google } from '@ai-sdk/google';
   // Správný model:
   const model = google('gemini-2.5-pro-preview-05-06');
   // NEBO pokud ten nefunguje:
   const model = google('gemini-2.0-flash');
   // NEBO:
   const model = google('gemini-1.5-pro');
   ```
   Zkus nejdřív `gemini-2.0-flash` — je nejrychlejší a nejspolehlivější pro tool-use.

3. **Packages nainstalované:**
   ```bash
   npm ls ai @ai-sdk/google
   ```
   Pokud chybí: `npm install ai @ai-sdk/google --workspace=apps/web`

4. **Chat endpoint musí streamovat:**
   ```typescript
   // apps/web/src/app/api/chat/route.ts
   import { streamText } from 'ai';
   import { google } from '@ai-sdk/google';
   
   export async function POST(req: Request) {
     const { messages } = await req.json();
     
     // Načti user z session
     const session = await getServerSession();
     if (!session?.user) return new Response('Unauthorized', { status: 401 });
     
     const result = streamText({
       model: google('gemini-2.0-flash'),
       system: systemPrompt, // System prompt z packages/ai
       messages,
       tools: coachTools,    // Tools z packages/ai
       maxSteps: 5,
     });
     
     return result.toDataStreamResponse();
   }
   ```

5. **Chat UI musí používat `useChat` z `ai/react`:**
   ```typescript
   'use client';
   import { useChat } from 'ai/react';
   
   export default function ChatPage() {
     const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
       api: '/api/chat',
     });
     
     // Zobraz error pokud je:
     if (error) console.error('Chat error:', error);
   }
   ```

6. **Otestuj API přímo:**
   Po opravě otevři browser console a zavolej:
   ```javascript
   fetch('/api/chat', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ messages: [{ role: 'user', content: 'Ahoj, jak se máš?' }] })
   }).then(r => r.text()).then(console.log).catch(console.error);
   ```
   Pokud vrátí chybu, vypiš ji.

7. **Pokud Gemini API vrací chybu:**
   - Ověř že API key je validní: `curl -H "x-goog-api-key: TVUJ_KEY" "https://generativelanguage.googleapis.com/v1beta/models"`
   - Pokud key nefunguje, vygeneruj nový na aistudio.google.com/apikey
   - Zkus jiný model (gemini-2.0-flash místo gemini-2.5-pro)

---

## Po opravách

1. Spusť `npx turbo build` — musí projít bez chyb
2. Restartuj dev server: `npx turbo dev`
3. Zkopíruj .env: `copy .env apps\web\.env`
4. Spusť manuální full sync (Settings → Sync)
5. Ověř:
   - Health stránka: grafy pro spánek, HRV, Body Battery, Training Readiness za 14 dní
   - Kalendář: správná data (ne posunutá), minulé i budoucí události
   - Chat: napiš "Ahoj" a ověř že AI odpoví
   - Worker: cron joby běží (loguj do konzole)
