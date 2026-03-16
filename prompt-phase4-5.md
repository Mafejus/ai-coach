# Claude Code — Fáze 4+5: Training Intelligence + Polish

## Kontext
Přečti si `architecture.md` v root složce — obsahuje kompletní architektonický návrh.
Fáze 0-3 jsou hotové — monorepo, data pipeline, dashboard UI, AI agent s chatem.
Teď implementujeme tréninkovou inteligenci, event management, periodizaci a finální polish.

---

# ČÁST A: FÁZE 4 — Training Intelligence

## 1. Event Management (Závody)

### Event CRUD stránka (`(dashboard)/events/page.tsx`)
Nová stránka pro správu závodů — přidej ji do sidebar navigace.

**Seznam závodů:**
- Karty seřazené chronologicky
- Každá karta: název, sport ikona, datum, countdown (dní do závodu), priorita badge
- Barevné rozlišení: MAIN = červená/gold, SECONDARY = modrá, TRAINING = šedá
- Minulé závody šedě s výsledky (pokud jsou)

**Formulář přidání/editace závodu (Dialog/Sheet):**
- Název závodu (text)
- Sport (select: RUN, BIKE, SWIM, TRIATHLON)
- Priorita (radio: Hlavní závod / Vedlejší závod / Tréninkový kemp)
- Datum (date picker)
- Vzdálenost celková (km)
- Pro triatlon: samostatné fieldy — plavání (km), kolo (km), běh (km)
- Cílový čas (input: HH:MM:SS)
- Poznámky (textarea)

**API routes:**
- `GET /api/events` — seznam závodů uživatele
- `POST /api/events` — vytvoř nový závod
- `PUT /api/events/[id]` — uprav závod
- `DELETE /api/events/[id]` — smaž závod

**Dashboard integrace:**
- Na hlavním dashboardu přidej sekci "Nadcházející závody" — top 3 nejbližší
- Countdown widget pro MAIN event (velký, prominentní)
- V AI system promptu: automaticky zahrnuj nadcházející závody s countdown

## 2. Training Periodization Engine

### Periodizace logic (`packages/ai/src/periodization.ts`)

Implementuj automatickou detekci tréninkové fáze na základě hlavního závodu:

```typescript
interface PeriodizationPlan {
  phases: PeriodPhase[];
  currentPhase: TrainingPhase;
  currentWeek: number;  // Kolikátý týden v aktuální fázi
  totalWeeks: number;   // Celkový počet týdnů do závodu
}

interface PeriodPhase {
  phase: TrainingPhase;  // BASE, BUILD, PEAK, TAPER, RACE, RECOVERY
  startDate: string;
  endDate: string;
  weeks: number;
  focus: string;
  weeklyHoursRange: { min: number; max: number };
  intensityDistribution: { easy: number; moderate: number; hard: number }; // procenta
}
```

**Pravidla periodizace:**
- Spočítej týdny od teď do hlavního závodu (MAIN event)
- Rozděl podle vzorce:
  - **≤6 týdnů:** BUILD (60%) → TAPER (2-3 týdny) → RACE
  - **7-12 týdnů:** BASE (30%) → BUILD (40%) → PEAK (15%) → TAPER (15%)
  - **13-20 týdnů:** BASE (35%) → BUILD (30%) → PEAK (15%) → TAPER (10%) → RACE
  - **>20 týdnů:** BASE (40%) → BUILD (25%) → PEAK (15%) → TAPER (10%) → RACE + RECOVERY bloky
- Vedlejší závody (SECONDARY): nezměň periodizaci, ale přidej mini-taper (3-5 dní)
- Taper = postupné snižování objemu (75% → 60% → 40% normálního objemu)

**Integrace:**
- Na Training stránce zobraz aktuální fázi s progress barem
- V weekly plan generátoru: fáze ovlivňuje distribuci intenzit
- V system promptu: agent ví v jaké fázi závodník je

## 3. Smart Weekly Plan Generator (vylepšení)

Vylepši `apps/worker/src/jobs/weekly-plan.ts`:

**Vstupy pro generování:**
1. Aktuální periodizační fáze + focus
2. Historie posledních 4 týdnů (objem, intenzita, compliance)
3. Nadcházející závody (tento + příští týden)
4. Aktivní zranění + omezení
5. Kalendář na příští týden (školní rozvrh, práce, osobní)
6. Fitness profil (max hodiny, zóny, prahové hodnoty)
7. Health trend (průměrný spánek, HRV trend, Training Readiness trend)

**AI prompt vylepšení:**
```
Vytvoř tréninkový plán na příští týden.

AKTUÁLNÍ FÁZE: ${phase} (týden ${weekNum}/${totalWeeks} do závodu)
FOCUS FÁZE: ${phaseFocus}
DISTRIBUCE INTENZIT: ${intensityDistribution}

HISTORIE (posledních 4 týdnů):
${weeklyHistory.map(w => `- Týden ${w.date}: ${w.actualHours}h / ${w.plannedHours}h (${w.compliance}%), TSS: ${w.actualTSS}`).join('\n')}

HEALTH TREND:
- Průměrný spánek: ${avgSleep} (trend: ${sleepTrend})
- Průměrné HRV: ${avgHRV} vs baseline ${hrvBaseline} (${hrvTrend})
- Training Readiness trend: ${readinessTrend}

KALENDÁŘ PŘÍŠTÍ TÝDEN:
${calendarEvents}

AKTIVNÍ ZRANĚNÍ:
${injuries}

NADCHÁZEJÍCÍ ZÁVODY:
${upcomingEvents}

Pravidla:
- Max ${maxHours}h/týden
- Fáze ${phase}: ${phaseRules}
- Hard/easy alternace
- Brick tréninky 1-2x/týden v BUILD fázi
- Respektuj kalendář — trénink jen do volných oken
- ${injuryRestrictions}
```

**Structured output:**
- Gemini musí vrátit validní JSON (WeeklyPlan type)
- Validuj output: nepřekročí max hodiny, respektuje zranění, hard/easy alternace
- Pokud validace selže, požádej Gemini o opravu (max 2 retry)

## 4. Dynamic Plan Adjustment

### Automatické úpravy plánu

Implementuj `packages/ai/src/plan-adjuster.ts`:

**Triggery pro automatickou úpravu:**
1. **Špatný spánek** (sleep score < 50): sniž intenzitu na EASY nebo přesuň hard trénink
2. **Nízké HRV** (>15% pod baseline): sniž objem o 20-30%
3. **Nízký Training Readiness** (<30): doporuč rest day
4. **Nízký Body Battery** (<20 ráno): rest day nebo velmi lehký trénink
5. **Nemoc** (uživatel nahlásí): cancel tréninky na 2-3 dny, pak postupný návrat
6. **Nesplněný trénink**: přesuň na další volný den (pokud je smysluplný)
7. **Přetrénování** (3+ dny s Training Readiness <40): vynuť recovery týden

**Morning report integrace:**
- Ranní report automaticky detekuje triggery
- Pokud je trigger aktivní, navrhne úpravu v reportu
- Uživatel může schválit/odmítnout v chatu

**API:**
- `POST /api/plan/adjust` — manuální trigger úpravy (z chatu nebo UI)
- Worker job `plan-adjustment` — on-demand, volaný z morning reportu

## 5. Plan Compliance & Analytics

### Training stránka vylepšení

**Compliance tracking:**
- Pro každý den: porovnej plánovaný vs skutečný trénink
- Matching logika: najdi aktivitu se stejným sportem ±1 den od plánu
- Zobraz: ✅ splněno (s metrikami), ⏭️ přesunuto, ❌ vynecháno, ➕ navíc (neplánovaný)

**Týdenní statistiky:**
- Plánováno vs skutečnost: hodiny, km, TSS
- Compliance %
- Bar chart: plán vs realita pro každý den

**Měsíční/sezónní přehled:**
- Line chart: týdenní objem (hodiny) za posledních 12 týdnů
- Stacked area: rozložení sportů (běh/kolo/plavání/síla)
- Compliance trend

**API:**
- `GET /api/plan/compliance?weekStart=DATE` — compliance pro daný týden
- `GET /api/plan/history?weeks=12` — historie plánů za N týdnů

## 6. Injury Intelligence (vylepšení)

### AI-powered injury management

**Při přidání zranění:**
1. Uživatel popíše zranění (text)
2. AI analyzuje a vygeneruje:
   - `avoidSports: Sport[]` — sporty k vynechání
   - `avoidMovements: string[]` — pohyby k vynechání ("intervaly", "kopce", "speed work")
   - `alternatives: string[]` — náhradní aktivity ("plavání", "aqua jogging", "spinning")
   - `estimatedRecovery: string` — odhad doby zotavení
   - `returnProtocol: string[]` — kroky k návratu ("začni chůzí 20min", "pak lehký běh 15min")
3. Ulož restrictions do DB
4. Automaticky uprav aktuální plán podle restrictions

**Progress tracking:**
- Uživatel může přidávat poznámky o vývoji
- AI sleduje progress a navrhuje úpravu severity
- Když se zranění zlepší: nabídni postupné zvyšování zátěže

**Integrace s plánem:**
- Weekly plan generator respektuje všechny injury restrictions
- Plan adjuster: pokud uživatel nahlásí bolest v chatu, automaticky loguje a upraví

---

# ČÁST B: FÁZE 5 — Polish & Production Ready

## 1. User Onboarding Flow

### Onboarding wizard (`(auth)/onboarding/page.tsx`)

Po prvním přihlášení (user nemá vyplněný fitness profil) → redirect na onboarding.

**Krok 1: Základní info**
- Jméno (předvyplněné z Google)
- Timezone (auto-detect, ale editovatelné)
- Hlavní sport: Triatlon / Běh / Oboje

**Krok 2: Fitness profil**
- Max HR (s kalkulačkou: 220 - věk jako default)
- Klidová HR (z Garminu pokud je propojený)
- FTP (kolo) — volitelné
- Threshold Pace (běh) — s pomocí: "Jaké je tvé tempo na 10K?"
- CSS (plavání) — volitelné
- Max hodin/týden na trénink

**Krok 3: Propojení služeb**
- Garmin Connect (email + heslo)
- Strava (OAuth)
- Onboarding zmíní že Google Calendar je už propojený

**Krok 4: Hlavní závod**
- "Máš naplánovaný závod?" → Ano/Ne
- Pokud ano: název, datum, sport, vzdálenost, cílový čas
- Pokud ne: "Jaký je tvůj cíl?" (zlepšit čas, zvýšit objem, hubnutí, ...)

**Krok 5: Initial sync**
- Automaticky spusť sync Garmin + Strava + Calendar
- Progress bar
- Po dokončení: "Tvůj AI trenér je připravený! 🎉"
- Redirect na dashboard

**Implementace:**
- Multi-step formulář (stepper UI)
- Každý krok ukládá data průběžně (ne až na konci)
- Pokud user odejde a vrátí se, pokračuje kde skončil
- Middleware: pokud user nemá fitness profil → redirect na onboarding

## 2. Multi-user & Pozvánky

### Pozvánkový systém

Jednoduché pozvánky pro kamarády (5-20 lidí):

**Invite flow:**
- V Settings → "Pozvat kamaráda"
- Vygeneruj unikátní invite link (jednorázový, expiruje za 7 dní)
- Kamarád klikne → Google login → onboarding
- Každý user má kompletně oddělená data

**Prisma schema rozšíření:**
```prisma
model Invite {
  id        String   @id @default(cuid())
  code      String   @unique
  createdBy String
  usedBy    String?
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@map("invites")
}
```

**API:**
- `POST /api/invites` — vytvoř pozvánku
- `GET /api/invites` — seznam mých pozvánek
- `GET /api/auth/invite/[code]` — validuj a aktivuj pozvánku

**Omezení:**
- Max 10 aktivních pozvánek na uživatele
- Invite link: `https://tvoje-domena.cz/invite/[code]`

## 3. PWA Optimalizace

### Service Worker (`public/sw.js`)

**Caching strategie:**
- App shell: cache-first (layout, CSS, JS)
- API data: network-first s fallback na cache
- Garmin/health data: stale-while-revalidate (data max 2h stará)
- Obrázky: cache-first

**Offline mode:**
- Zobraz cached dashboard data pokud je offline
- Banner: "Jsi offline — data mohou být neaktuální"
- Chat nedostupný offline (zobraz zprávu)

**Install prompt:**
- Na dashboardu zobraz banner "Nainstaluj si AI Coach na plochu" (pokud není nainstalovaná)
- `beforeinstallprompt` event handler
- Dismiss + "Připomenout později"

**iOS specifické:**
- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: black-translucent`
- Splash screen images pro různé velikosti

## 4. Error Handling & Monitoring

### Global error handling

**Frontend:**
- Error boundary pro každou hlavní sekci
- Toast notifikace (Sonner) pro API chyby
- Retry logika pro failed API calls (max 3x)
- Graceful fallback: pokud sync selže, zobraz "Nepodařilo se načíst data. Zkus to znovu."

**Backend:**
- Try/catch na všech API routes
- Structured logging: `console.log(JSON.stringify({ level, message, userId, timestamp, error }))`
- Garmin auth failures: automatický retry s novým login
- Strava token refresh: automatický, pokud selže → odpoj a notifikuj uživatele

**Health check:**
- `GET /api/health` — vrať status všech služeb:
  - DB connection: OK/ERROR
  - Redis connection: OK/ERROR
  - Garmin: last sync time + status
  - Strava: token status
  - Calendar: token status

### Rate limiting
- Redis-based rate limiter na API routes
- Garmin: max 1 request / 2 sekundy (v klientovi)
- Chat: max 20 zpráv / hodinu / uživatel
- Sync: max 1 sync / 5 minut / uživatel

## 5. Performance Optimalizace

**Database:**
- Přidej chybějící indexy na často dotazované sloupce
- Connection pooling (PgBouncer nebo Prisma connection pool)
- Pagination na activities a health_metrics (ne `findMany` bez limitu)

**Frontend:**
- React.lazy pro těžké komponenty (grafy)
- Virtualizace dlouhých seznamů (activities) — react-window nebo tanstack-virtual
- Image optimization přes next/image
- Bundle analysis: `next build --analyze`

**Caching:**
- Redis cache pro dashboard agregace (TTL 5 min)
- SWR nebo React Query pro client-side caching
- Stale-while-revalidate na health metriky

## 6. UI/UX Polish

**Micro-interactions:**
- Skeleton loading pro každou kartu (shimmer efekt)
- Smooth transitions mezi stránkami
- Pull-to-refresh na mobile (PWA)
- Haptic feedback simulace (CSS animation na tlačítkách)

**Empty states:**
- Každá stránka musí mít hezký prázdný stav:
  - Activities: "Zatím nemáš žádné aktivity. Propoj Garmin nebo Stravu v Nastavení."
  - Health: "Zdravotní data se zobrazí po synchronizaci s Garminem."
  - Calendar: "Propoj Google Calendar pro zobrazení rozvrhu."
  - Chat: "Začni konverzaci se svým AI trenérem. Zkus: Jaký mám plán na dnes?"
  - Training: "Tvůj tréninkový plán bude vygenerován po zadání prvního závodu."

**Responsivní vylepšení:**
- Sidebar: na mobile → bottom navigation bar (5 ikon: Dashboard, Chat, Training, Activities, More)
- Grafy: horizontal scroll na mobile pro wide grafy
- Chat: full-screen na mobile

**Dark mode refinement:**
- Konzistentní barvy všude
- Kontrast: text musí mít min 4.5:1 ratio
- Active/hover states na všech interaktivních prvcích
- Focus rings pro accessibility

## 7. Notifications & Reminders

**Push notifikace typy:**
1. 🌅 Ranní report (6:00 nebo dle nastavení)
2. 🏋️ Připomínka tréninku (1h před plánovaným tréninkem)
3. ⚠️ Změna plánu (když AI automaticky upraví plán)
4. 📊 Týdenní shrnutí (neděle večer)
5. 🏆 Milestone (nový PR, streak, compliance 100%)

**Notification preferences (Settings):**
- Toggle pro každý typ notifikace
- Čas ranního reportu (time picker)
- Tichý režim (od-do)

---

# TECHNICKÉ POŽADAVKY

## Prisma schema změny
- Přidej model `Invite` (viz výše)
- Přidej `Event` relations kde chybí
- Přidej případné chybějící indexy

## Nové dependencies
- `react-window` nebo `@tanstack/react-virtual` pro virtualizaci
- Žádné další velké knihovny — využij co už je nainstalované

## Build & Deploy
- `npx turbo build` musí projít bez chyb
- Všechny TypeScript strict mode errors opravené
- Žádné `any` typy (kromě JSON sloupců z Prisma)
- ESLint clean

## Co NEDĚLEJ
- Neměň existující fungující auth flow
- Neměň Garmin/Strava/Calendar klienty (pokud neopravuješ bug)
- Neměň AI system prompt (pokud ho nevylepšuješ)
- Nemazej existující API routes
- Nepřidávej nové external dependencies bez důvodu
