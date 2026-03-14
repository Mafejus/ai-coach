# Claude Code — Fáze 0: Inicializace monorepa

## Kontext
Přečti si soubor `architecture.md` v root složce projektu — obsahuje kompletní architektonický návrh aplikace AI Training Coach.

## Tvůj úkol
Inicializuj Turborepo monorepo podle architektury v `architecture.md`. Potřebuji funkční základ, na kterém budu stavět další fáze.

## Co přesně chci vytvořit:

### 1. Turborepo monorepo struktura
- Root `package.json` s workspaces (`apps/*`, `packages/*`)
- `turbo.json` s pipeline (build, dev, lint, typecheck)
- Root `tsconfig.json` (base config)
- `.gitignore` (node_modules, .next, .env, dist, .turbo)
- `.env.example` se všemi potřebnými proměnnými

### 2. Apps

#### `apps/web` — Next.js 15 (App Router)
- Next.js 15 s TypeScript (strict mode)
- Tailwind CSS 4 + shadcn/ui (inicializuj s default theme, dark mode)
- App Router struktura podle architecture.md:
  - `(auth)/` route group (zatím prázdné stránky login/register)
  - `(dashboard)/` route group s layoutem (sidebar + header)
    - `page.tsx` — Dashboard (zatím placeholder)
    - `chat/page.tsx` — AI Chat placeholder
    - `training/page.tsx` — Training plan placeholder
    - `activities/page.tsx` — Activities placeholder
    - `health/page.tsx` — Health metrics placeholder
    - `calendar/page.tsx` — Calendar placeholder
    - `injuries/page.tsx` — Injuries placeholder
    - `settings/page.tsx` — Settings placeholder
- PWA manifest (`public/manifest.json`) podle architecture.md
- Základní layout s mobilním responsivním designem
- Placeholder pages s názvem sekce a ikonou

#### `apps/worker` — Background Worker
- Jednoduchý TypeScript project
- Entry point `src/index.ts` s BullMQ worker setupem
- Placeholder joby: `garmin-sync.ts`, `strava-sync.ts`, `calendar-sync.ts`, `morning-report.ts`, `weekly-plan.ts`
- `schedules.ts` s cron definicemi (zatím zakomentované)

### 3. Packages

#### `packages/db` — Prisma + Database
- Prisma 6 setup
- Schema přesně podle `architecture.md` sekce 5 (všechny modely, enumy, indexy)
- `client.ts` — Prisma client singleton
- Export types

#### `packages/ai` — AI Agent Logic
- Vercel AI SDK (`ai` package) + `@ai-sdk/google`
- `agent.ts` — základní agent orchestrátor (skeleton)
- `tools/` — skeleton pro všechny tools z architecture.md (get-health, get-activities, get-calendar, get-injuries, get-plan, update-plan, log-injury, get-event-countdown)
- `prompts/system.ts` — system prompt přesně podle architecture.md sekce 6
- `prompts/morning-report.ts` — skeleton
- `prompts/weekly-plan.ts` — skeleton

#### `packages/garmin` — Garmin Integration
- Skeleton s types a client strukturou
- `client.ts`, `auth.ts`, `parsers.ts`, `types.ts`

#### `packages/strava` — Strava Integration
- Skeleton s types a client strukturou

#### `packages/calendar` — Google Calendar Integration
- Skeleton s types a client strukturou

#### `packages/shared` — Shared Types & Utils
- TypeScript typy podle architecture.md (Sport, WorkoutType, WeeklyPlan, DayPlan, PlannedWorkout, WorkoutStep, TrainingPhase)
- `utils/date.ts` — date helpers (getMonday, formatPace, today)
- `utils/zones.ts` — HR/Pace zone calculator skeleton
- `utils/conversions.ts` — unit conversions skeleton

### 4. Docker Compose
- `docker-compose.yml` pro lokální dev:
  - PostgreSQL 16 (port 5432, db: ai_coach, user: postgres, pass: postgres)
  - Redis 7 (port 6379)
- Volumes pro perzistenci dat

### 5. Konfigurace
- ESLint config (shared)
- Prettier config
- TypeScript strict mode všude
- Path aliases (`@/` pro apps/web, `@ai-coach/db`, `@ai-coach/ai`, atd.)

## Důležité požadavky
- Všechny packages musí být správně propojené přes workspace references
- `turbo dev` musí spustit web + worker současně
- `turbo build` musí projít bez chyb
- Prisma schema musí být validní (`npx prisma validate`)
- Po spuštění Docker Compose + `turbo dev` musí být web dostupný na localhost:3000

## Co NEDĚLEJ
- Neimplementuj žádnou business logiku (jen skeletony)
- Neřeš auth (to bude v další fázi)
- Nedělej API routes (kromě základního health checku `/api/health`)
- Neinstaluj garmin-connect ani jiné data source knihovny (jen typy)
