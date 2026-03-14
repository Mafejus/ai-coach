# Claude Code — Fáze 1: Data Pipeline (Garmin + Strava + Google Calendar)

## Kontext
Přečti si `architecture.md` v root složce — obsahuje kompletní architektonický návrh.
Fáze 0 je hotová — monorepo, Prisma schema, Next.js PWA, placeholder stránky.
Teď implementujeme datovou pipeline — stahování reálných dat z externích služeb.

## Přehled úkolů

### 1. Auth systém (NextAuth.js v5 / Auth.js)

Implementuj NextAuth.js v5 s těmito providery:

**Google OAuth Provider:**
- Scope: `openid email profile https://www.googleapis.com/auth/calendar.readonly`
- Podporuje 2 Google účty (osobní + školní) — ulož tokeny do DB (User.googleTokens, User.googleTokens2)
- Callback: `/api/auth/callback/google`
- Po přihlášení vytvoř/aktualizuj User v DB

**Credentials Provider (pro Garmin):**
- Garmin nemá OAuth — uživatel zadá email + heslo v Settings
- Heslo šifruj AES-256-GCM před uložením do DB (User.garminPassword)
- Encryption key z ENV: `GARMIN_ENCRYPTION_KEY`

**Strava OAuth Provider:**
- Strava má vlastní OAuth2 flow (ne přes NextAuth)
- Endpoint `/api/auth/strava` → redirect na Strava auth
- Callback `/api/auth/strava/callback` → ulož tokeny do DB (User.stravaTokens)
- Auto-refresh expired tokens

**Session strategie:**
- JWT session (ne database sessions)
- Session obsahuje: userId, email, name
- Middleware: chraň všechny routes kromě (auth)/ a /api/health

**Soubory k vytvoření/upravení:**
- `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- `apps/web/src/app/api/auth/strava/route.ts`
- `apps/web/src/app/api/auth/strava/callback/route.ts`
- `apps/web/src/lib/auth.ts` (NextAuth config)
- `apps/web/src/lib/encryption.ts` (AES-256-GCM encrypt/decrypt)
- `apps/web/src/middleware.ts` (route protection)
- Aktualizuj `(auth)/login/page.tsx` s Google login tlačítkem

### 2. Garmin Connect Integration

Implementuj `packages/garmin/` — neoficiální Garmin Connect client.

**Použij knihovnu `garmin-connect` (npm):**
```bash
npm install garmin-connect --workspace=packages/garmin
```

**Client (`packages/garmin/src/client.ts`):**
- Login s email + heslo (dešifruj z DB)
- Metody:
  - `getSleepData(date: string)` → spánek (skóre, fáze, délka)
  - `getHeartRate(date: string)` → klidová tepovka, HR přes den
  - `getHRVData(date: string)` → HRV overnight average + baseline
  - `getUserSummary(date: string)` → Body Battery, Stress Score, Training Readiness
  - `getActivities(start: number, limit: number)` → seznam aktivit
  - `getActivityDetails(activityId: string)` → detaily, laps, splits
  - `getTrainingStatus(date: string)` → VO2max, Training Load

**Parsery (`packages/garmin/src/parsers.ts`):**
- `parseHealthMetrics(rawData) → HealthMetric` (mapuj na Prisma model)
- `parseActivity(rawData) → Activity` (mapuj na Prisma model)
- Ošetři null/undefined hodnoty — Garmin data jsou často nekonzistentní

**Auth management (`packages/garmin/src/auth.ts`):**
- Session cookie caching (neloguj se při každém requestu)
- Auto-relogin pokud session expiruje
- Rate limiting: max 1 request / 2 sekundy (použij sleep/delay)

### 3. Strava API Integration

Implementuj `packages/strava/` — oficiální Strava API v3.

**Client (`packages/strava/src/client.ts`):**
- OAuth2 token management (access + refresh tokens)
- Auto-refresh expired tokens (Strava tokeny expirují po 6h)
- Base URL: `https://www.strava.com/api/v3`
- Metody:
  - `getActivities(after: number, perPage?: number)` → seznam aktivit
  - `getDetailedActivity(activityId: number)` → laps, splits, streams
  - `getAthleteStats()` → celkové statistiky
  - `getAthlete()` → profil atleta

**Webhook handler (`packages/strava/src/webhook.ts`):**
- Endpoint: `/api/webhooks/strava` (POST)
- Verifikace webhook subscription (GET — hub.challenge response)
- Při nové aktivitě → trigger sync job pro daného uživatele
- Webhook events: `activity.create`, `activity.update`, `activity.delete`

**Parsery (`packages/strava/src/parsers.ts`):**
- `parseActivity(stravaActivity) → Activity` (mapuj na Prisma model)
- Mapuj sport typy: Run→RUN, Ride→BIKE, Swim→SWIM, WeightTraining→STRENGTH
- Konverze: distance (metry), elapsed_time (sekundy), average_speed → pace (sec/km)

### 4. Google Calendar Integration

Implementuj `packages/calendar/` — Google Calendar API v3.

**Client (`packages/calendar/src/client.ts`):**
- OAuth2 s tokeny z DB (User.googleTokens / googleTokens2)
- Auto-refresh expired tokens
- Podporuj 2 Google účty:
  - Primární: osobní kalendář
  - Sekundární: školní kalendář (pokud propojený)
- Metody:
  - `getEvents(calendarId: string, timeMin: Date, timeMax: Date)` → události
  - `listCalendars()` → seznam dostupných kalendářů

**Parsery (`packages/calendar/src/parsers.ts`):**
- `parseEvent(googleEvent) → CalendarEvent` (mapuj na Prisma model)
- Nastav `source`: "google_primary" nebo "google_school"
- AI kategorizace: na základě titulu eventu urči category ("school", "work", "personal", "sport")
  - Jednoduchá keyword-based klasifikace (ne AI — to by bylo moc drahé):
    - "přednáška", "cvičení", "zkouška", "seminář" → "school"
    - "směna", "meeting", "porada" → "work"
    - "trénink", "závod", "běh", "kolo" → "sport"
    - vše ostatní → "personal"

### 5. Settings Page — Propojení služeb

Aktualizuj `apps/web/src/app/(dashboard)/settings/page.tsx`:

**Sekce "Propojené služby":**
- **Google účet (primární):** Stav propojení, tlačítko "Propojit" / "Odpojit"
- **Google účet (škola):** Stav propojení, tlačítko "Propojit druhý účet"
- **Garmin Connect:** Formulář pro email + heslo, tlačítko "Uložit" / "Test připojení"
- **Strava:** Stav propojení, tlačítko "Propojit se Stravou"

**Sekce "Fitness profil":**
- Max HR, Klidová HR, FTP (kolo), Threshold Pace (běh), CSS (plavání)
- Max hodin/týden
- Timezone selector
- Čas ranního reportu

**API routes:**
- `PUT /api/settings/profile` — aktualizuj fitness profil
- `PUT /api/settings/garmin` — ulož Garmin credentials (šifrovaně)
- `POST /api/settings/garmin/test` — test Garmin připojení
- `DELETE /api/settings/google` — odpoj Google účet
- `DELETE /api/settings/strava` — odpoj Strava

### 6. Sync API Routes

Vytvoř API endpointy pro manuální trigger synchronizace:

- `POST /api/sync/garmin` — stáhni poslední data z Garminu (health + activities)
- `POST /api/sync/strava` — stáhni nové aktivity ze Stravy
- `POST /api/sync/calendar` — aktualizuj kalendářní události
- `POST /api/sync/all` — spusť všechny syncy

Každý endpoint:
1. Načti uživatele z session
2. Zavolej příslušný client
3. Parsuj data
4. Upsert do DB (deduplikace přes externalId)
5. Vrať počet nových/aktualizovaných záznamů

**Deduplikace:**
- Garmin: `source=GARMIN, externalId=garminActivityId`
- Strava: `source=STRAVA, externalId=stravaActivityId`
- Calendar: `source+externalId` unique constraint

### 7. BullMQ Worker Jobs

Implementuj reálné job handlery v `apps/worker/`:

**garmin-sync.ts:**
- Pro každého uživatele s Garmin credentials:
  - Stáhni health metriky za včerejšek + dnešek
  - Stáhni nové aktivity (od posledního syncu)
  - Upsert do DB
- Cron: každé 2 hodiny (`0 */2 * * *`)

**strava-sync.ts:**
- Pro každého uživatele se Strava tokeny:
  - Stáhni nové aktivity (od posledního syncu)
  - Pro každou novou aktivitu stáhni detaily (laps, splits)
  - Upsert do DB
- Cron: každé 3 hodiny (`0 */3 * * *`) + on-demand přes webhook

**calendar-sync.ts:**
- Pro každého uživatele s Google tokeny:
  - Stáhni události na příštích 7 dní
  - Upsert do DB (smaž staré, přidej nové)
- Cron: každou hodinu (`0 * * * *`)

**Worker entry point (`apps/worker/src/index.ts`):**
- Připoj se na Redis
- Registruj všechny workers
- Nastav cron schedules (odkomentuj z Fáze 0)
- Graceful shutdown

### 8. Environment Variables

Aktualizuj `.env.example` s novými proměnnými:
```
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Strava OAuth
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=

# Garmin
GARMIN_ENCRYPTION_KEY=your-32-byte-hex-key

# Google AI (Gemini)
GOOGLE_AI_API_KEY=
```

## Technické požadavky

- Všechny external API volání musí mít proper error handling (try/catch, retry logic)
- Loguj úspěšné i neúspěšné syncy (console.log s timestamps)
- Garmin rate limiting: max 1 request / 2 sekundy
- Strava rate limiting: respektuj 429 response, exponential backoff
- Google Calendar: respektuj quota limits
- Token refresh: automaticky refreshuj expired OAuth tokeny
- Deduplikace: nikdy nevytvářej duplicitní záznamy (upsert pattern)

## Co NEDĚLEJ
- Neimplementuj morning report ani weekly plan (to je Fáze 3)
- Neměň dashboard UI (to je Fáze 2)
- Neimplementuj AI chat (to je Fáze 3)
- Push notifikace zatím ne
