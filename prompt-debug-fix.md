# Claude Code — Debug & Fix (krok po kroku)

## INSTRUKCE: Postupuj PŘESNĚ v tomto pořadí. U každého kroku NEJDŘÍV diagnostikuj, pak oprav. Nepostupuj na další krok dokud předchozí nefunguje.

---

## KROK 1: Diagnostika Garmin health dat

Spánek, HRV a Training Readiness se vůbec nestahují. Body Battery a stress mají jen 1 datový bod.

### 1A) Zjisti co garmin-connect knihovna umí:
```bash
node -e "const gc = require('garmin-connect'); console.log(Object.getOwnPropertyNames(gc.GarminConnect.prototype))"
```
Vypiš VŠECHNY dostupné metody. Potřebuju vidět jaké metody pro health data existují.

### 1B) Otestuj Garmin API přímo:
Vytvoř testovací skript `scripts/test-garmin.ts`:
```typescript
import { GarminConnect } from 'garmin-connect';
import { decrypt } from '../apps/web/src/lib/encryption';
import { prisma } from '../packages/db/src/client';

async function test() {
  // 1. Načti Garmin credentials z DB
  const user = await prisma.user.findFirst();
  if (!user?.garminEmail || !user?.garminPassword) {
    console.error('No Garmin credentials in DB');
    return;
  }
  
  const password = decrypt(user.garminPassword);
  console.log('Logging in as:', user.garminEmail);
  
  const gc = new GarminConnect({ username: user.garminEmail, password });
  await gc.login();
  console.log('✅ Login successful');
  
  const today = new Date().toISOString().split('T')[0]; // '2026-03-17'
  const yesterday = '2026-03-16';
  
  // 2. Zkus VŠECHNY možné metody pro health data
  const methods = [
    ['getSleep', yesterday],
    ['getSleepData', yesterday],
    ['getDailySleep', yesterday],
    ['getHRVData', yesterday],
    ['getHRV', yesterday],
    ['getUserSummary', yesterday],
    ['getDailySummary', yesterday],
    ['getHeartRate', yesterday],
    ['getTrainingReadiness', yesterday],
    ['getTrainingStatus', yesterday],
    ['getBodyBattery', yesterday],
    ['getStress', yesterday],
    ['getStressData', yesterday],
    ['getAllDaySummaries', yesterday],
    ['getDailyStats', yesterday],
  ];
  
  for (const [method, arg] of methods) {
    try {
      if (typeof gc[method] === 'function') {
        const result = await gc[method](arg);
        console.log(`\n✅ ${method}(${arg}):`);
        console.log(JSON.stringify(result, null, 2).substring(0, 1000));
        await new Promise(r => setTimeout(r, 2000)); // rate limit
      } else {
        console.log(`❌ ${method} — metoda neexistuje`);
      }
    } catch (e) {
      console.log(`⚠️ ${method} — error: ${e.message}`);
    }
  }
}

test().catch(console.error).finally(() => process.exit());
```

Spusť tento skript: `npx tsx scripts/test-garmin.ts`

Vypiš mi KOMPLETNÍ výstup — potřebuju vidět:
- Které metody existují
- Jakou strukturu data mají (klíče, formát hodnot)
- Které metody vracejí null/undefined

### 1C) Na základě výstupu oprav parsery:
- Uprav `packages/garmin/src/parsers.ts` tak aby správně mapoval SKUTEČNOU strukturu dat z Garmin API
- Uprav `packages/garmin/src/client.ts` tak aby volal SPRÁVNÉ metody (ty co existují a fungují)
- Pro KAŽDÝ den za posledních 14 dní stáhni a ulož VŠECHNY dostupné metriky
- Ulož raw JSON data do `rawData` pole v health_metrics pro debugging

### 1D) Spusť sync a ověř:
- Spusť manuální Garmin sync
- Zkontroluj DB: `npx prisma studio` — health_metrics tabulka musí mít záznamy za 14 dní
- Každý záznam musí mít vyplněné: sleepScore, sleepDuration, bodyBattery, restingHR (minimum)

---

## KROK 2: Fix AI Chat

Chat vůbec nefunguje — buď hází chybu nebo neodpovídá.

### 2A) Diagnostika — zkontroluj tyto soubory a vypiš obsah:
1. `apps/web/src/app/api/chat/route.ts` — existuje? Jaký model používá? Jaký env variable čte?
2. `apps/web/src/app/(dashboard)/chat/page.tsx` — používá `useChat`?
3. `.env` — obsahuje `GOOGLE_AI_API_KEY`? (Vypiš jen název proměnné, ne hodnotu)
4. `apps/web/.env` — obsahuje `GOOGLE_AI_API_KEY`?

### 2B) Otestuj Gemini API přímo:
Vytvoř skript `scripts/test-ai.ts`:
```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

async function test() {
  console.log('GOOGLE_AI_API_KEY set:', !!process.env.GOOGLE_AI_API_KEY);
  console.log('Key starts with:', process.env.GOOGLE_AI_API_KEY?.substring(0, 10));
  
  try {
    // Zkus různé modely
    for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']) {
      try {
        console.log(`\nTesting model: ${modelName}...`);
        const result = await generateText({
          model: google(modelName),
          prompt: 'Řekni "funguju" česky.',
        });
        console.log(`✅ ${modelName}: ${result.text}`);
        break; // Pokud model funguje, skonči
      } catch (e) {
        console.log(`❌ ${modelName}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('Fatal error:', e);
  }
}

test();
```

Spusť: `npx tsx --env-file=.env scripts/test-ai.ts`

### 2C) Na základě výstupu oprav:
- Pokud API key chybí → ověř .env soubory
- Pokud model nefunguje → použij ten co funguje
- Pokud chat route chybí nebo je špatně → přepiš kompletně:

```typescript
// apps/web/src/app/api/chat/route.ts
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    const result = streamText({
      model: google('gemini-2.0-flash'), // NEBO model co fungoval v testu
      system: `Jsi AI trenér pro triatlon a běh. Komunikuj česky, stručně a konkrétně. Pomáháš závodníkovi s tréninkovým plánem, regenerací a přípravou na závody.`,
      messages,
      maxSteps: 5,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 2D) Otestuj chat v browseru:
- Otevři localhost:3000/chat
- Napiš "Ahoj"
- AI musí odpovědět česky
- Pokud stále nefunguje, podívej se do browser console (F12) a do server terminálu na chyby

---

## KROK 3: Fix Morning Report

### 3A) Morning report závisí na funkčním AI (Krok 2) a na health datech (Krok 1).
Pokud Krok 1 a 2 fungují, morning report by měl taky.

### 3B) Zkontroluj morning report job:
- Existuje `apps/worker/src/jobs/morning-report.ts`?
- Volá Gemini API?
- Má přístup k DB (health metriky, plán, kalendář)?

### 3C) Přidej manuální trigger:
- API route: `POST /api/reports/generate` — vygeneruj dnešní morning report on-demand
- Na dashboard přidej tlačítko "Vygenerovat ranní report"
- Po kliknutí: zavolej API, zobraz loading, pak zobraz report

### 3D) Morning report logika:
```typescript
// POST /api/reports/generate
export async function POST(req: Request) {
  const user = await getAuthUser(req);
  
  // Získej data
  const [health, activities, calendar, injuries] = await Promise.all([
    prisma.healthMetric.findFirst({ where: { userId: user.id }, orderBy: { date: 'desc' } }),
    prisma.activity.findMany({ where: { userId: user.id, date: { gte: subDays(new Date(), 2) } } }),
    prisma.calendarEvent.findMany({ where: { userId: user.id, startTime: { gte: startOfToday(), lte: endOfToday() } } }),
    prisma.injury.findMany({ where: { userId: user.id, active: true } }),
  ]);
  
  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    prompt: `Vygeneruj ranní briefing pro závodníka.
    
    ZDRAVOTNÍ DATA (dnes/včerejšek):
    ${JSON.stringify(health)}
    
    VČEREJŠÍ TRÉNINKY:
    ${JSON.stringify(activities)}
    
    DNEŠNÍ KALENDÁŘ:
    ${JSON.stringify(calendar)}
    
    AKTIVNÍ ZRANĚNÍ:
    ${JSON.stringify(injuries)}
    
    Formát:
    🌅 Shrnutí regenerace
    📊 Klíčové metriky
    🏋️ Doporučení pro dnešní trénink
    📅 Denní přehled
    ⚠️ Varování (pokud jsou)
    💪 Motivace`,
  });
  
  // Ulož report
  const report = await prisma.dailyReport.upsert({
    where: { userId_date: { userId: user.id, date: startOfToday() } },
    create: { userId: user.id, date: startOfToday(), markdown: text, report: {}, metricsUsed: { health, activities, calendar } },
    update: { markdown: text, report: {}, metricsUsed: { health, activities, calendar } },
  });
  
  return Response.json({ report });
}
```

---

## KROK 4: Ověření

Po opravách ověř VŠECHNO:

1. **Health data:** `npx prisma studio` → health_metrics má záznamy za 14 dní s vyplněnými hodnotami
2. **Health stránka:** Grafy pro spánek, HRV, Body Battery, Training Readiness, klidová tepovka, stress — VŠECHNY musí mít data
3. **AI Chat:** Napiš "Ahoj, jak jsem se vyspal?" → AI musí odpovědět česky
4. **Morning report:** Klikni "Vygenerovat report" → zobrazí se briefing
5. **Build:** `npx turbo build` projde bez chyb

Pokud něco z toho nefunguje, vypiš přesnou chybu a oprav ji. NESKONČÍ dokud vše 4 body nefungují.
