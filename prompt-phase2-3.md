# Claude Code — Fáze 2+3: Dashboard UI + AI Agent & Chat

## Kontext
Přečti si `architecture.md` v root složce — obsahuje kompletní architektonický návrh.
Fáze 0 (monorepo scaffold) a Fáze 1 (data pipeline — Garmin, Strava, Calendar, Auth) jsou hotové.
Teď implementujeme vizuální dashboard s reálnými daty a AI agenta s chatem.

---

# ČÁST A: FÁZE 2 — Dashboard UI

## 1. Dashboard Overview (`(dashboard)/page.tsx`)

Hlavní stránka po přihlášení. Zobrazuje dnešní přehled:

**Horní řada — 4 metrické karty (dnes):**
- **Body Battery** — aktuální hodnota (0-100), barevný indikátor (zelená >60, žlutá 30-60, červená <30), malý sparkline za 7 dní
- **Spánek** — délka (7h 23min), skóre (0-100), bar chart fází (deep/REM/light/awake)
- **HRV** — dnešní hodnota (ms), porovnání s baseline (šipka nahoru/dolů + %), sparkline 7 dní
- **Training Readiness** — hodnota (0-100), barevný indikátor, doporučení (Ready/Moderate/Rest)

**Střední sekce — Dnešní plán:**
- Karty s naplánovanými tréninky na dnes (z TrainingPlan)
- Každá karta: sport ikona, název, délka, intenzita (barevný badge), stav (planned/completed)
- Pokud je trénink splněný (matched s Activity), zobraz ✅ a skutečné metriky

**Spodní sekce — Kalendář dnes:**
- Timeline view dnešních událostí z CalendarEvent
- Barevné rozlišení: school=modrá, work=oranžová, personal=šedá, sport=zelená
- Volná okna pro trénink zvýrazněná

**Data loading:**
- Server components kde je to možné (přímý přístup do DB přes Prisma)
- Pro klientské komponenty (grafy, interaktivní prvky) použij API routes
- Loading skeletons pro každou sekci

### API Routes pro Dashboard:
- `GET /api/dashboard/today` — agregovaná data pro dnešní přehled
- `GET /api/health/metrics?from=DATE&to=DATE` — health metriky za období
- `GET /api/activities?from=DATE&to=DATE&sport=SPORT` — aktivity za období

## 2. Health Page (`(dashboard)/health/page.tsx`)

Detailní přehled zdravotních metrik s interaktivními grafy.

**Použij Recharts knihovnu:**
```bash
npm install recharts --workspace=apps/web
```

**Časový filtr (horní lišta):**
- Tlačítka: 7 dní | 14 dní | 30 dní | 90 dní
- Default: 14 dní

**Grafy (každý jako samostatná komponenta v `components/charts/`):**

1. **Sleep Chart** (`SleepChart.tsx`):
   - Stacked bar chart — fáze spánku (deep=tmavě modrá, REM=fialová, light=světle modrá, awake=červená)
   - Line overlay — sleep score
   - X osa: dny, Y osa: hodiny
   - Tooltip s detaily

2. **HRV Chart** (`HRVChart.tsx`):
   - Area chart — HRV hodnoty
   - Horizontální čára — baseline
   - Barevné zóny: nad baseline = zelená, pod = červená (průhledné pozadí)
   - Tooltip: hodnota, baseline, % rozdíl

3. **Body Battery Chart** (`BodyBatteryChart.tsx`):
   - Area chart s gradientem (zelená nahoře, červená dole)
   - Y osa: 0-100
   - Referenční čáry na 30 a 60

4. **Resting HR Chart** (`RestingHRChart.tsx`):
   - Line chart — klidová tepovka trend
   - Průměrná hodnota jako referenční čára

5. **Training Readiness Chart** (`TrainingReadinessChart.tsx`):
   - Bar chart s barevným kódováním (zelená >60, žlutá 30-60, červená <30)

6. **Stress Chart** (`StressChart.tsx`):
   - Area chart — stress score
   - Invertovaná barva (nižší = lepší = zelená)

**Statistiky pod grafy:**
- Průměry za vybrané období
- Min/Max hodnoty
- Trend (zlepšení/zhoršení oproti předchozímu období)

## 3. Activities Page (`(dashboard)/activities/page.tsx`)

Historie tréninků s filtrováním a detaily.

**Filtry (horní lišta):**
- Sport: Všechny | Běh | Kolo | Plavání | Síla
- Období: 7d | 30d | 90d | Vše
- Zdroj: Všechny | Garmin | Strava

**Seznam aktivit:**
- Karta pro každou aktivitu:
  - Sport ikona (🏃 🚴 🏊 🏋️)
  - Název, datum, čas
  - Klíčové metriky: vzdálenost, čas, průměrné tempo/rychlost, průměrná HR
  - Training Load badge (easy/moderate/hard)
  - Zdroj badge (Garmin/Strava)

**Detail aktivity (modal nebo drawer):**
- Všechny dostupné metriky
- Laps tabulka (pokud jsou k dispozici)
- HR zóny rozložení (pie chart nebo horizontal bar)

**Souhrn nahoře:**
- Celkový počet aktivit za období
- Celkové km / hodiny
- Rozložení podle sportu (mini donut chart)

## 4. Calendar Page (`(dashboard)/calendar/page.tsx`)

Týdenní přehled s tréninky a událostmi.

**Týdenní view:**
- 7 sloupců (Po-Ne), řádky = hodiny (6:00-22:00)
- Události z CalendarEvent jako barevné bloky
- Plánované tréninky jako speciální bloky (s intenzitou)
- Navigace: ← tento týden →

**Denní view (klik na den):**
- Detailní timeline
- Volná okna pro trénink zvýrazněná zeleně
- Tréninky s detaily (struktura, zóny)

## 5. Training Page (`(dashboard)/training/page.tsx`)

Tréninkový plán na aktuální týden.

**Týdenní plán:**
- 7 karet (Po-Ne)
- Každý den: plánované tréninky s detaily
- Odpočinkové dny jasně označené
- Splněné tréninky: ✅ se skutečnými metrikami vs plánovanými

**Compliance meter:**
- Progress bar: % splněného plánu tento týden
- Plánovaný vs skutečný objem (hodiny, km)

**Nadcházející závody:**
- Karty s countdown (dny do závodu)
- Aktuální tréninková fáze (BASE/BUILD/PEAK/TAPER)

## 6. Injuries Page (`(dashboard)/injuries/page.tsx`)

Správa zranění a omezení.

**Aktivní zranění:**
- Karta pro každé zranění:
  - Tělesná část + ikona
  - Popis, závažnost (MILD/MODERATE/SEVERE s barvou)
  - Datum začátku, trvání
  - AI-generovaná omezení (co vynechat, alternativy)
- Tlačítko "Přidat zranění" → formulář

**Historie zranění:**
- Timeline vyléčených zranění

**Formulář přidání zranění:**
- Tělesná část (dropdown nebo body map)
- Popis (textarea)
- Závažnost (radio: mírné/střední/vážné)
- Po uložení: AI vygeneruje omezení (zavolá Gemini s kontextem)

## 7. Společné UI komponenty

**Dark mode design (primární):**
- Background: zinc-950 (#09090b)
- Cards: zinc-900 s border zinc-800
- Text: zinc-100 (primary), zinc-400 (secondary)
- Accent: blue-500 pro běh, orange-500 pro kolo, cyan-500 pro plavání, purple-500 pro sílu
- Barvy sportů konzistentní všude

**Responsivní design:**
- Mobile-first
- Sidebar: collapsible na mobile (hamburger menu)
- Grafy: responsive, stacked na mobile
- Karty: grid na desktop, stack na mobile

**Skeletony / Loading states:**
- Shimmer loading pro každou kartu a graf
- Suspense boundaries

---

# ČÁST B: FÁZE 3 — AI Agent & Chat

## 1. Chat UI (`(dashboard)/chat/page.tsx`)

Moderní chat rozhraní s AI trenérem.

**Layout:**
- Full-height chat (sidebar vlevo, chat vpravo)
- Seznam konverzací v levém panelu (nebo drawer na mobile)
- Hlavní chat area s message bubbles
- Input bar dole (textarea + send button)

**Message typy:**
- **User message:** pravá strana, modrý bubble
- **AI message:** levá strana, tmavý bubble, markdown rendering
- **Tool call indikátor:** malý badge "📊 Načítám zdravotní data..." během tool-use
- **Structured response:** karty, tabulky, grafy přímo v chatu (např. dnešní metriky)

**Funkce:**
- Streaming response (text se vypisuje postupně)
- Markdown rendering (bold, lists, tables, code blocks, emoji)
- Auto-scroll na poslední zprávu
- "Nová konverzace" tlačítko
- Historie konverzací (seznam vlevo)

**Implementace:**
- Použij `useChat` hook z Vercel AI SDK (`ai/react`)
- Streaming přes `/api/chat` endpoint
- Konverzace se ukládají do DB (Conversation model)

```typescript
// apps/web/src/app/(dashboard)/chat/page.tsx
'use client';
import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });
  // ... render chat UI
}
```

## 2. Chat API Endpoint (`/api/chat/route.ts`)

Streaming chat endpoint s AI agentem.

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
```

**Flow:**
1. Přijmi messages + conversationId z requestu
2. Ověř session (NextAuth)
3. Načti user profil + kontext (injuries, events, aktuální plán)
4. Sestav system prompt (z `packages/ai/src/prompts/system.ts`)
5. Zavolej `streamText` s Gemini modelem + tools
6. `maxSteps: 5` — agent může volat max 5 nástrojů na jednu odpověď
7. `onFinish` — ulož konverzaci do DB

**Kontext pro system prompt:**
- User profil (HR zóny, FTP, CSS, max hodiny/týden)
- Aktivní zranění
- Nadcházející závody s countdown
- Aktuální tréninková fáze

## 3. AI Tools — Plná implementace (`packages/ai/src/tools/`)

Implementuj všechny tools s reálnými DB dotazy:

**getHealthMetrics:**
- Input: startDate, endDate
- Query: `db.healthMetric.findMany(...)` filtrované pro aktuálního uživatele
- Output: pole health metrik

**getActivities:**
- Input: startDate, endDate, sport? (volitelné), limit (default 20)
- Query: `db.activity.findMany(...)` s filtrováním
- Output: pole aktivit s klíčovými metrikami

**getCalendar:**
- Input: startDate, endDate
- Query: `db.calendarEvent.findMany(...)` seřazené chronologicky
- Output: pole kalendářních událostí

**getTrainingPlan:**
- Input: weekStart? (volitelné, default tento týden)
- Query: `db.trainingPlan.findUnique(...)` pro daný týden
- Output: týdenní plán nebo null

**updateTrainingPlan:**
- Input: weekStart, changes (date, action, workoutId?, newWorkout?, moveToDate?, reason)
- Logika: načti plán → aplikuj změnu → ulož → přidej do adjustments historie
- Actions: modify (změň trénink), skip (vynech), swap (vyměň za jiný), add (přidej), move (přesuň na jiný den)
- Output: aktualizovaný plán

**logInjury:**
- Input: bodyPart, description, severity
- Logika: vytvoř Injury v DB → zavolej Gemini pro vygenerování restrictions (avoidSports, avoidMovements, alternatives)
- Output: vytvořené zranění s restrictions

**getActiveInjuries:**
- Input: žádný
- Query: `db.injury.findMany({ where: { userId, active: true } })`
- Output: pole aktivních zranění

**getEventCountdown:**
- Input: žádný
- Query: nadcházející eventy seřazené podle data
- Output: eventy s daysUntil

## 4. System Prompt — Finální verze

Implementuj `packages/ai/src/prompts/system.ts` přesně podle architecture.md sekce 6.

System prompt musí obsahovat:
- Role: elitní triatlonový a běžecký trenér
- Profil závodníka (dynamicky z DB)
- Aktuální cíle (nadcházející závody)
- Aktivní zranění
- 8 pravidel trénování (max hodiny, hard/easy alternace, Training Readiness threshold, HRV checks, respektování kalendáře, zranění, brick tréninky, periodizace)
- Styl komunikace (česky, stručně, s daty, přímý, emoji pro zóny)

**Důležité:** System prompt se generuje dynamicky při každém API callu — obsahuje aktuální data, ne statický text.

## 5. Morning Report (`apps/worker/src/jobs/morning-report.ts`)

Implementuj ranní report generator:

**Trigger:** Cron job v 6:00 (dle user timezone)

**Pipeline:**
1. Pro každého uživatele s aktivním plánem:
2. Stáhni: zdravotní metriky za dnešek/včerejšek, dnešní plán, dnešní kalendář, aktivní zranění, nadcházející závody, včerejší aktivity
3. Sestav morning report prompt
4. Zavolej Gemini (`generateText`)
5. Ulož do DB (DailyReport)
6. Pošli push notifikaci (pokud má user push subscription)

**Morning Report Prompt:**
```
Na základě dnešních dat vygeneruj ranní briefing pro závodníka.

DNEŠNÍ ZDRAVOTNÍ DATA:
- Spánek: [skóre, délka, fáze]
- HRV: [hodnota vs baseline]
- Body Battery: [ranní hodnota]
- Training Readiness: [hodnota]
- Klidová tepovka: [hodnota]

VČEREJŠÍ TRÉNINK:
[aktivita nebo "rest day"]

DNEŠNÍ PLÁN:
[plánované tréninky]

DNEŠNÍ KALENDÁŘ:
[události — škola, práce, osobní]

AKTIVNÍ ZRANĚNÍ:
[seznam nebo "žádná"]

NADCHÁZEJÍCÍ ZÁVODY:
[seznam s countdown]

Formát odpovědi:
1. 🌅 Shrnutí regenerace (1-2 věty)
2. 📊 Klíčové metriky (tabulka)
3. 🏋️ Dnešní trénink — potvrď nebo uprav plán na základě dat
4. 📅 Denní přehled (kdy trénovat vzhledem ke kalendáři)
5. ⚠️ Varování (pokud jsou — špatný spánek, nízká HRV, zranění)
6. 💪 Motivace (krátká, na míru)
```

**Zobrazení reportu:**
- Nová stránka nebo sekce na dashboardu
- Markdown rendering
- Lze otevřít z push notifikace

## 6. Weekly Plan Generator (`apps/worker/src/jobs/weekly-plan.ts`)

Implementuj generátor týdenních plánů:

**Trigger:** Cron job v neděli 20:00

**Pipeline:**
1. Získej: historii posledních 4 týdnů (aktivity, compliance), nadcházející závody, aktivní zranění, kalendář na příští týden, fitness profil
2. Sestav weekly plan prompt
3. Zavolej Gemini s structured output (JSON)
4. Parsuj výstup na WeeklyPlan type
5. Ulož do DB (TrainingPlan)

**Weekly Plan Prompt:**
```
Vytvoř tréninkový plán na příští týden pro závodníka.

[fitness profil, historie, zranění, závody, kalendář]

Vrať POUZE validní JSON v tomto formátu:
{
  "weekStart": "2024-01-15",
  "phase": "BUILD",
  "focus": "Zvyšování tempové vytrvalosti",
  "totalHours": 8.5,
  "totalTSS": 450,
  "days": [
    {
      "date": "2024-01-15",
      "dayOfWeek": "Pondělí",
      "isRestDay": false,
      "workouts": [...],
      "notes": "Po víkendovém dlouhém běhu lehčí den"
    }
  ]
}
```

**Validace:**
- Nepřekroč max hodin/týden
- Hard/easy alternace
- Respektuj kalendář (žádné tréninky během školy/práce)
- Respektuj zranění

## 7. Push Notifikace

**Web Push API setup:**
- Vygeneruj VAPID keys: `npx web-push generate-vapid-keys`
- Endpoint: `POST /api/push/subscribe` — ulož subscription do DB (User.pushSubscription)
- Service Worker handler v `public/sw.js`

**Implementace:**
- `apps/web/src/lib/push.ts` — subscribe/unsubscribe helpers
- `packages/shared/src/utils/push.ts` — sendPushNotification funkce (pro worker)
- Notifikace: ranní report, změna plánu, připomínka tréninku

**Push payload:**
```json
{
  "title": "🌅 Ranní briefing",
  "body": "Spánek 82/100, Body Battery 76. Dnes tempo běh 8km.",
  "url": "/dashboard",
  "icon": "/icons/icon-192.png"
}
```

## 8. Conversation Management

**API routes:**
- `GET /api/conversations` — seznam konverzací uživatele (seřazené od nejnovější)
- `POST /api/conversations` — vytvoř novou konverzaci
- `GET /api/conversations/[id]` — načti konkrétní konverzaci s messages
- `DELETE /api/conversations/[id]` — smaž konverzaci

**Auto-title:**
- Po 2. user message zavolej Gemini: "Vygeneruj krátký název (max 5 slov) pro tuto konverzaci: [messages]"
- Ulož jako conversation.title

## 9. Daily Report View

**Dashboard integrace:**
- Na hlavní dashboard stránce přidej sekci "Ranní report"
- Pokud existuje dnešní report → zobraz markdown
- Pokud ne → zobraz "Report bude vygenerován v [čas]"
- Tlačítko "Vygenerovat teď" (manuální trigger)

**Dedicated stránka (volitelné):**
- `(dashboard)/reports/page.tsx` — historie reportů
- Seznam reportů seřazený od nejnovějšího
- Kliknutím otevři detail

---

# TECHNICKÉ POŽADAVKY

## Styling
- Konzistentní dark mode theme (zinc-950 background)
- shadcn/ui komponenty kde je to možné (Card, Button, Badge, Dialog, Sheet, Tabs, Select)
- Recharts pro všechny grafy (ResponsiveContainer, custom colors matching theme)
- Framer Motion nebo CSS transitions pro micro-interactions
- Mobile-first responsive design

## Performance
- Server components kde je to možné (data fetching)
- Client components jen pro interaktivní prvky (grafy, chat, formuláře)
- Suspense boundaries s loading skeletons
- Optimistic updates pro chat

## Error Handling
- Toast notifikace pro úspěch/chybu (shadcn/ui Sonner nebo Toast)
- Graceful fallbacks pokud nejsou data (prázdné stavy s instrukcemi)
- AI tool errors: zobraz "Nepodařilo se načíst data" v chatu

## Co NEDĚLEJ
- Neměň auth systém z Fáze 1
- Neměň Prisma schema (pokud to není nezbytně nutné)
- Neměň sync pipeline z Fáze 1
- Neimplementuj event management UI (to je Fáze 4)
- Neimplementuj periodization logic (to je Fáze 4)
