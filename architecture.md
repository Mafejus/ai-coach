# 🏋️ AI Training Coach — Architektonický návrh

## 1. Vize projektu

Personalizovaný AI trenér pro triatlon a běh, který automaticky stahuje zdravotní a tréninková data z Garminu, analyzuje denní program z kalendáře a dynamicky přizpůsobuje tréninkový plán. Komunikuje přes moderní PWA s integrovaným chatem.

**Uživatelé:** Ty + kamarádi (5–20 lidí), multi-tenant architektura od začátku.

**Klíčové principy:**
- API-first design (frontend je jen jeden z klientů)
- PWA místo nativní app (žádný App Store, funguje na iOS i Android)
- Event-driven architektura (background workery pro sync a reporty)
- AI agent s tool-use pattern (ne jen prompt → response)

---

## 2. Tech Stack

| Vrstva | Technologie | Proč |
|--------|------------|------|
| **Framework** | Next.js 15 (App Router) | Full-stack, SSR/SSG, API routes, server actions |
| **Jazyk** | TypeScript (strict) | Type safety end-to-end |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Rychlý vývoj, konzistentní UI, dark mode |
| **PWA** | next-pwa + Service Worker | Instalovatelné na iOS/Android, offline, push notifikace |
| **Databáze** | PostgreSQL (Railway) | Relační data, JSON sloupce pro raw data, full-text search |
| **ORM** | Prisma 6 | Type-safe queries, migrace, studio pro debug |
| **Cache / Queue** | Redis (Railway) + BullMQ | Job queue pro sync, cron joby, rate limiting |
| **AI Engine** | Gemini 2.5 Pro (Google AI Studio) | Tool-use, structured output, štědrý free tier |
| **AI Abstraction** | Vercel AI SDK (`ai` package) | Jednotné rozhraní — přepnutí na Claude/GPT jedním řádkem |
| **Auth** | NextAuth.js v5 (Auth.js) | Google OAuth (kalendář), credentials pro Garmin |
| **Push** | Web Push API + web-push | Ranní reporty, notifikace o změnách plánu |
| **Hosting** | Railway | PostgreSQL + Redis + Web service + Worker service |
| **Monorepo** | Turborepo | Sdílené typy a logika mezi web a worker |

### Proč Vercel AI SDK jako abstrakce?

```typescript
// Přepnutí modelu = změna jednoho importu
import { google } from '@ai-sdk/google';
// import { anthropic } from '@ai-sdk/anthropic';
// import { openai } from '@ai-sdk/openai';

const result = await generateText({
  model: google('gemini-2.5-pro'),
  tools: coachTools,
  messages: conversation,
});
```

---

## 3. Architektura systému

```
┌─────────────────────────────────────────────────────────────┐
│                     KLIENTI (PWA)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │Dashboard │  │ AI Chat  │  │ Kalendář │  │  Tréninky  │  │
│  │(metriky) │  │ (agent)  │  │  (plán)  │  │ (historie) │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       └──────────────┴─────────────┴──────────────┘         │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS (REST + Streaming)
┌──────────────────────────┼──────────────────────────────────┐
│                    NEXT.JS SERVER                           │
│                          │                                  │
│  ┌───────────────────────┴────────────────────────────┐     │
│  │              API Routes + Server Actions            │     │
│  │  /api/chat    /api/sync    /api/health   /api/plan │     │
│  └───────────────────────┬────────────────────────────┘     │
│                          │                                  │
│  ┌───────────┐  ┌────────┴───────┐  ┌──────────────────┐   │
│  │  Auth.js  │  │   AI Engine    │  │  Data Services   │   │
│  │  (OAuth)  │  │ (Gemini+Tools) │  │ (Garmin/Strava/  │   │
│  └───────────┘  └────────────────┘  │  Calendar)       │   │
│                                     └──────────────────┘   │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────┼──────────────────────────────────────────────┐
│          DATA LAYER                                         │
│  ┌───────────┴───────────┐    ┌─────────────────────────┐   │
│  │    PostgreSQL         │    │    Redis + BullMQ        │   │
│  │ (users, activities,   │    │ (job queue, cache,       │   │
│  │  metrics, plans,      │    │  rate limiting,          │   │
│  │  conversations)       │    │  session store)          │   │
│  └───────────────────────┘    └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
               │
┌──────────────┼──────────────────────────────────────────────┐
│        WORKER SERVICE (samostatný Railway service)          │
│  ┌───────────┴───────────────────────────────────────────┐  │
│  │                  BullMQ Workers                        │  │
│  │                                                       │  │
│  │  ⏰ garmin-sync     → každé 2h: stáhni nová data     │  │
│  │  ⏰ strava-sync     → webhook + polling               │  │
│  │  ⏰ calendar-sync   → každou 1h: aktualizuj events    │  │
│  │  ⏰ morning-report  → 6:00 AM: vygeneruj briefing    │  │
│  │  ⏰ weekly-plan     → neděle 20:00: plán na týden     │  │
│  │  📩 plan-adjustment → on-demand: AI úprava plánu      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
               │
┌──────────────┼──────────────────────────────────────────────┐
│       EXTERNÍ API                                           │
│  ┌─────────┐  ┌────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Garmin  │  │ Strava │  │ Google   │  │ Google AI    │   │
│  │ Connect │  │  API   │  │ Calendar │  │ (Gemini)     │   │
│  └─────────┘  └────────┘  └──────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Struktura projektu (Turborepo monorepo)

```
ai-coach/
├── apps/
│   ├── web/                          # Next.js PWA (frontend + API)
│   │   ├── public/
│   │   │   ├── manifest.json         # PWA manifest
│   │   │   ├── sw.js                 # Service Worker
│   │   │   └── icons/                # App ikony (192, 512px)
│   │   ├── src/
│   │   │   ├── app/                  # Next.js App Router
│   │   │   │   ├── (auth)/           # Auth pages (login, register)
│   │   │   │   ├── (dashboard)/      # Hlavní app layout
│   │   │   │   │   ├── page.tsx              # Dashboard (overview)
│   │   │   │   │   ├── chat/page.tsx         # AI Chat
│   │   │   │   │   ├── training/page.tsx     # Tréninkový plán
│   │   │   │   │   ├── activities/page.tsx   # Historie aktivit
│   │   │   │   │   ├── health/page.tsx       # Zdravotní metriky
│   │   │   │   │   ├── calendar/page.tsx     # Denní přehled
│   │   │   │   │   ├── injuries/page.tsx     # Správa zranění
│   │   │   │   │   └── settings/page.tsx     # Nastavení, propojení
│   │   │   │   ├── api/
│   │   │   │   │   ├── chat/route.ts         # AI chat endpoint (streaming)
│   │   │   │   │   ├── webhooks/
│   │   │   │   │   │   └── strava/route.ts   # Strava webhook receiver
│   │   │   │   │   ├── sync/
│   │   │   │   │   │   ├── garmin/route.ts   # Trigger Garmin sync
│   │   │   │   │   │   └── calendar/route.ts # Trigger Calendar sync
│   │   │   │   │   ├── health/route.ts       # Health metrics CRUD
│   │   │   │   │   ├── activities/route.ts   # Activities CRUD
│   │   │   │   │   ├── plan/route.ts         # Training plan CRUD
│   │   │   │   │   ├── injuries/route.ts     # Injuries CRUD
│   │   │   │   │   └── push/subscribe/route.ts  # Push subscription
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn/ui components
│   │   │   │   ├── charts/           # Recharts wrappers (HR, pace, sleep)
│   │   │   │   ├── chat/             # Chat UI components
│   │   │   │   ├── dashboard/        # Dashboard widgets
│   │   │   │   └── training/         # Training plan components
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   └── lib/                  # Client-side utilities
│   │   ├── next.config.ts
│   │   └── tailwind.config.ts
│   │
│   └── worker/                       # Background worker service
│       ├── src/
│       │   ├── index.ts              # Worker entry point
│       │   ├── jobs/
│       │   │   ├── garmin-sync.ts    # Garmin data sync job
│       │   │   ├── strava-sync.ts    # Strava data sync job
│       │   │   ├── calendar-sync.ts  # Calendar sync job
│       │   │   ├── morning-report.ts # Daily briefing generator
│       │   │   └── weekly-plan.ts    # Weekly plan generator
│       │   └── schedules.ts          # Cron schedule definitions
│       └── package.json
│
├── packages/
│   ├── db/                           # Shared database layer
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts             # Prisma client singleton
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ai/                           # AI agent logic
│   │   ├── src/
│   │   │   ├── agent.ts              # Main agent orchestrator
│   │   │   ├── tools/                # Agent tools (functions)
│   │   │   │   ├── get-health.ts
│   │   │   │   ├── get-activities.ts
│   │   │   │   ├── get-calendar.ts
│   │   │   │   ├── get-injuries.ts
│   │   │   │   ├── get-plan.ts
│   │   │   │   ├── update-plan.ts
│   │   │   │   ├── log-injury.ts
│   │   │   │   └── index.ts
│   │   │   ├── prompts/
│   │   │   │   ├── system.ts          # Main system prompt
│   │   │   │   ├── morning-report.ts  # Morning briefing prompt
│   │   │   │   └── weekly-plan.ts     # Weekly planning prompt
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── garmin/                       # Garmin Connect integration
│   │   ├── src/
│   │   │   ├── client.ts             # Garmin API client
│   │   │   ├── auth.ts               # Session management
│   │   │   ├── parsers.ts            # Raw data → structured types
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── strava/                       # Strava API integration
│   │   ├── src/
│   │   │   ├── client.ts             # Strava OAuth + API client
│   │   │   ├── webhook.ts            # Webhook handler
│   │   │   ├── parsers.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── calendar/                     # Google Calendar integration
│   │   ├── src/
│   │   │   ├── client.ts             # Calendar API client
│   │   │   ├── parsers.ts            # Event → structured schedule
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   └── shared/                       # Shared types & utils
│       ├── src/
│       │   ├── types/                # Shared TypeScript types
│       │   │   ├── sport.ts          # Sport, EventType enums
│       │   │   ├── health.ts         # HealthMetric types
│       │   │   ├── training.ts       # TrainingPlan, Workout types
│       │   │   └── index.ts
│       │   └── utils/
│       │       ├── date.ts           # Date helpers (timezone-aware)
│       │       ├── zones.ts          # HR/Pace zone calculators
│       │       └── conversions.ts    # Unit conversions
│       └── package.json
│
├── turbo.json                        # Turborepo config
├── package.json                      # Root workspace
├── docker-compose.yml                # Local dev (PostgreSQL + Redis)
└── .env.example
```

---

## 5. Datový model (Prisma schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// ENUMS
// ============================================

enum Sport {
  RUN
  BIKE
  SWIM
  TRIATHLON
  STRENGTH
  OTHER
}

enum EventPriority {
  MAIN       // Hlavní závod (např. Ironman, maraton)
  SECONDARY  // Vedlejší závody (přípravné, testovací)
  TRAINING   // Tréninkový kemp, soustředění
}

enum DataSource {
  GARMIN
  STRAVA
  MANUAL
}

enum PlanStatus {
  DRAFT
  ACTIVE
  ADJUSTED
  COMPLETED
}

enum InjurySeverity {
  MILD        // Mírné, lze trénovat s omezením
  MODERATE    // Nutná úprava tréninku
  SEVERE      // Pauza od sportu
}

enum WorkoutType {
  EASY
  TEMPO
  INTERVAL
  LONG_RUN
  RECOVERY
  RACE_PACE
  BRICK       // Triatlon specifické (bike→run)
  OPEN_WATER
  STRENGTH
  REST
}

// ============================================
// MODELS
// ============================================

model User {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String
  passwordHash    String?  // Pro lokální auth (volitelné)

  // Timezone — klíčové pro cron joby a reporty
  timezone        String   @default("Europe/Prague")

  // Fitness profil (AI potřebuje pro personalizaci)
  maxHR           Int?     // Maximální tepovka
  restHR          Int?     // Klidová tepovka
  ftp             Int?     // Functional Threshold Power (kolo)
  thresholdPace   Int?     // Závodní tempo (sec/km) na 10K
  swimCSS         Int?     // Critical Swim Speed (sec/100m)
  weeklyHoursMax  Float?   // Max hodin týdně na trénink

  // OAuth tokeny (encrypted v DB)
  garminEmail     String?
  garminPassword  String?   // ⚠️ Šifrované (AES-256)
  stravaTokens    Json?     // { accessToken, refreshToken, expiresAt }
  googleTokens    Json?     // { accessToken, refreshToken, expiresAt }
  googleTokens2   Json?     // Druhý Google účet (škola)

  // Push notifikace
  pushSubscription Json?   // Web Push subscription object

  // Preferences
  morningReportTime String @default("06:00")  // Čas ranního reportu
  preferredUnits    String @default("metric")  // metric / imperial

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relace
  events          Event[]
  activities      Activity[]
  healthMetrics   HealthMetric[]
  trainingPlans   TrainingPlan[]
  dailyReports    DailyReport[]
  injuries        Injury[]
  conversations   Conversation[]
  calendarEvents  CalendarEvent[]

  @@map("users")
}

model Event {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String        // "Ironman 70.3 Zell am See"
  sport       Sport
  priority    EventPriority
  date        DateTime
  distance    Float?        // Celková vzdálenost v km
  swimDist    Float?        // Plavání v km (triatlon)
  bikeDist    Float?        // Kolo v km (triatlon)
  runDist     Float?        // Běh v km (triatlon)
  targetTime  Int?          // Cílový čas v sekundách
  notes       String?

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([userId, date])
  @@map("events")
}

model Activity {
  id              String     @id @default(cuid())
  userId          String
  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  source          DataSource
  externalId      String?    // Garmin/Strava ID pro deduplikaci
  sport           Sport
  workoutType     WorkoutType?
  name            String?    // "Ranní běh", "Tempo na dráze"
  date            DateTime
  duration        Int        // v sekundách
  distance        Float?     // v metrech
  avgHR           Int?
  maxHR           Int?
  avgPace         Float?     // sec/km (běh), sec/100m (plavání)
  avgPower        Int?       // watty (kolo)
  normalizedPower Int?       // NP (kolo)
  trainingLoad    Float?     // Garmin Training Effect / Strava Suffer Score
  calories        Int?
  elevationGain   Float?     // v metrech
  avgCadence      Int?       // kroky/min (běh), otáčky/min (kolo)
  poolLength      Int?       // v metrech (plavání)
  swolf           Float?     // SWOLF score (plavání)

  // Splits / Laps pro detailní analýzu
  laps            Json?      // Array of lap objects
  rawData         Json?      // Kompletní raw data ze zdroje

  createdAt       DateTime   @default(now())

  @@unique([source, externalId])
  @@index([userId, date])
  @@index([userId, sport, date])
  @@map("activities")
}

model HealthMetric {
  id                  String   @id @default(cuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  date                DateTime @db.Date  // Jeden záznam na den

  // Spánek
  sleepScore          Int?     // 0-100
  sleepDuration       Int?     // minuty
  deepSleep           Int?     // minuty
  remSleep            Int?     // minuty
  lightSleep          Int?     // minuty
  awakeDuration       Int?     // minuty
  sleepStart          DateTime?
  sleepEnd            DateTime?

  // Srdeční metriky
  restingHR           Int?     // Klidová tepovka
  hrvStatus           Float?   // HRV (ms) — overnight average
  hrvBaseline         Float?   // HRV baseline pro porovnání

  // Garmin specifické skóre
  bodyBattery         Int?     // 0-100, ranní hodnota
  bodyBatteryChange   Int?     // Změna za noc (+ = dobíjení)
  stressScore         Int?     // 0-100 (nižší = lepší)
  trainingReadiness   Int?     // 0-100
  vo2max              Float?   // VO2max odhad

  // SpO2
  spo2Avg             Float?
  spo2Min             Float?

  // Celkový raw dump
  rawData             Json?

  createdAt           DateTime @default(now())

  @@unique([userId, date])
  @@index([userId, date])
  @@map("health_metrics")
}

model CalendarEvent {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  source        String   // "google_primary", "google_school"
  externalId    String   // Google Calendar event ID
  title         String
  startTime     DateTime
  endTime       DateTime
  isAllDay      Boolean  @default(false)
  location      String?
  category      String?  // "school", "work", "personal" (AI classified)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([source, externalId])
  @@index([userId, startTime, endTime])
  @@map("calendar_events")
}

model TrainingPlan {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  weekStart     DateTime   @db.Date  // Pondělí daného týdne
  targetEventId String?    // FK na Event (volitelné)
  status        PlanStatus @default(DRAFT)

  // Strukturovaný plán
  plan          Json       // WeeklyPlan type (viz níže)

  // Historie úprav (audit trail)
  adjustments   Json?      // Array of { date, reason, changes, aiGenerated }

  // Metriky plánu
  plannedHours  Float?     // Plánovaný objem (hodiny)
  plannedTSS    Float?     // Plánovaný Training Stress Score
  actualHours   Float?     // Skutečný objem
  actualTSS     Float?     // Skutečný TSS
  compliance    Float?     // % splnění plánu

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@unique([userId, weekStart])
  @@index([userId, status])
  @@map("training_plans")
}

model DailyReport {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  date          DateTime @db.Date
  report        Json     // Strukturovaný report (viz typ níže)
  markdown      String   // Rendered markdown pro zobrazení
  metricsUsed   Json     // Snapshot metrik použitých pro generování
  aiModel       String?  // Který model generoval report

  createdAt     DateTime @default(now())

  @@unique([userId, date])
  @@map("daily_reports")
}

model Injury {
  id            String          @id @default(cuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  bodyPart      String          // "left_achilles", "right_knee", "lower_back"
  description   String          // Uživatelský popis
  severity      InjurySeverity
  startDate     DateTime        @db.Date
  endDate       DateTime?       @db.Date
  active        Boolean         @default(true)

  // AI-generovaná omezení
  restrictions  Json?           // { avoidSports: [], avoidMovements: [], alternatives: [] }

  // Poznámky o vývoji
  progressNotes Json?           // Array of { date, note, severity }

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([userId, active])
  @@map("injuries")
}

model Conversation {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  title         String?  // Auto-generated summary
  messages      Json     // Array of { role, content, timestamp, toolCalls? }
  tokenCount    Int      @default(0)  // Pro sledování spotřeby

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId, updatedAt])
  @@map("conversations")
}
```

### JSON typy (TypeScript)

```typescript
// packages/shared/src/types/training.ts

interface WeeklyPlan {
  weekStart: string;           // ISO date
  phase: TrainingPhase;        // BASE, BUILD, PEAK, TAPER, RECOVERY
  focus: string;               // "Budování aerobní základny"
  totalHours: number;
  totalTSS: number;
  days: DayPlan[];
}

interface DayPlan {
  date: string;                // ISO date
  dayOfWeek: string;
  workouts: PlannedWorkout[];
  isRestDay: boolean;
  notes?: string;              // "Lehký den — včera dlouhý běh"
}

interface PlannedWorkout {
  id: string;
  sport: Sport;
  workoutType: WorkoutType;
  title: string;               // "Tempo běh 5x1km"
  description: string;         // Detailní popis
  duration: number;            // Plánovaná délka (min)
  distance?: number;           // Plánovaná vzdálenost (km)
  intensity: 'easy' | 'moderate' | 'hard' | 'max';
  structure?: WorkoutStep[];   // Strukturovaný trénink
  completed: boolean;
  actualActivityId?: string;   // Link na skutečnou aktivitu
}

interface WorkoutStep {
  type: 'warmup' | 'work' | 'rest' | 'cooldown';
  duration?: number;           // sekundy
  distance?: number;           // metry
  targetHR?: { min: number; max: number };
  targetPace?: { min: number; max: number }; // sec/km
  targetPower?: { min: number; max: number }; // watty
  repeat?: number;             // počet opakování
}

// Training periodization phases
type TrainingPhase = 'BASE' | 'BUILD' | 'PEAK' | 'TAPER' | 'RECOVERY';
```

---

## 6. AI Agent — Architektura

### System Prompt (jádro)

```typescript
// packages/ai/src/prompts/system.ts

export function buildSystemPrompt(user: UserProfile, context: AgentContext) {
  return `
Jsi elitní triatlonový a běžecký trenér s 20+ lety zkušeností.
Trénuješ závodníka ${user.name}.

## PROFIL ZÁVODNÍKA
- Sport: Triatlon (70.3, olympijský) + Běh (maraton, půlmaraton, trail)
- Max HR: ${user.maxHR} bpm | Klidová HR: ${user.restHR} bpm
- FTP (kolo): ${user.ftp}W | Práh (běh): ${formatPace(user.thresholdPace)}/km
- CSS (plavání): ${formatPace(user.swimCSS)}/100m
- Dostupný čas: max ${user.weeklyHoursMax}h/týden
- Zóny: ${JSON.stringify(calculateZones(user))}

## AKTUÁLNÍ CÍLE
${context.events.map(e => `- ${e.priority}: ${e.name} (${e.sport}) — ${e.date} — cíl: ${e.targetTime}`).join('\n')}

## AKTIVNÍ ZRANĚNÍ
${context.injuries.map(i => `- ${i.bodyPart}: ${i.description} (${i.severity}) — omezení: ${JSON.stringify(i.restrictions)}`).join('\n') || 'Žádná'}

## PRAVIDLA TRÉNOVÁNÍ
1. Nikdy nepřekroč max ${user.weeklyHoursMax}h/týden.
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
`;
}
```

### Agent Tools (Function Calling)

```typescript
// packages/ai/src/tools/index.ts

import { tool } from 'ai';
import { z } from 'zod';

export const coachTools = {
  getHealthMetrics: tool({
    description: 'Získej zdravotní metriky (spánek, HRV, Body Battery, Training Readiness) za zadané období',
    parameters: z.object({
      startDate: z.string().describe('ISO date'),
      endDate: z.string().describe('ISO date'),
    }),
    execute: async ({ startDate, endDate }) => {
      return await db.healthMetric.findMany({
        where: { userId, date: { gte: new Date(startDate), lte: new Date(endDate) } },
        orderBy: { date: 'desc' },
      });
    },
  }),

  getActivities: tool({
    description: 'Získej historii tréninků. Lze filtrovat podle sportu a období.',
    parameters: z.object({
      startDate: z.string(),
      endDate: z.string(),
      sport: z.enum(['RUN', 'BIKE', 'SWIM', 'STRENGTH', 'OTHER']).optional(),
      limit: z.number().default(20),
    }),
    execute: async ({ startDate, endDate, sport, limit }) => {
      return await db.activity.findMany({
        where: {
          userId,
          date: { gte: new Date(startDate), lte: new Date(endDate) },
          ...(sport && { sport }),
        },
        orderBy: { date: 'desc' },
        take: limit,
      });
    },
  }),

  getCalendar: tool({
    description: 'Získej události z kalendáře (škola, práce, osobní) za zadané období',
    parameters: z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
    execute: async ({ startDate, endDate }) => {
      return await db.calendarEvent.findMany({
        where: {
          userId,
          startTime: { gte: new Date(startDate) },
          endTime: { lte: new Date(endDate) },
        },
        orderBy: { startTime: 'asc' },
      });
    },
  }),

  getTrainingPlan: tool({
    description: 'Získej aktuální tréninkový plán na tento nebo zadaný týden',
    parameters: z.object({
      weekStart: z.string().optional().describe('ISO date pondělí. Default = tento týden.'),
    }),
    execute: async ({ weekStart }) => {
      const monday = weekStart
        ? new Date(weekStart)
        : getMonday(new Date());
      return await db.trainingPlan.findUnique({
        where: { userId_weekStart: { userId, weekStart: monday } },
      });
    },
  }),

  updateTrainingPlan: tool({
    description: 'Uprav tréninkový plán — přesuň trénink, změň intenzitu, nahraď cvičení',
    parameters: z.object({
      weekStart: z.string(),
      changes: z.object({
        date: z.string(),
        action: z.enum(['modify', 'skip', 'swap', 'add', 'move']),
        workoutId: z.string().optional(),
        newWorkout: z.any().optional(),
        moveToDate: z.string().optional(),
        reason: z.string(),
      }),
    }),
    execute: async ({ weekStart, changes }) => {
      // Aplikuj změny na plán + ulož do adjustment history
      // ...
    },
  }),

  logInjury: tool({
    description: 'Zaznamenej nové zranění nebo aktualizuj existující',
    parameters: z.object({
      bodyPart: z.string(),
      description: z.string(),
      severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
    }),
    execute: async ({ bodyPart, description, severity }) => {
      // Vytvoř zranění + AI vygeneruje restrictions
      // ...
    },
  }),

  getActiveInjuries: tool({
    description: 'Získej seznam aktivních zranění a jejich omezení',
    parameters: z.object({}),
    execute: async () => {
      return await db.injury.findMany({
        where: { userId, active: true },
      });
    },
  }),

  getEventCountdown: tool({
    description: 'Získej odpočet dní do cílových závodů',
    parameters: z.object({}),
    execute: async () => {
      const events = await db.event.findMany({
        where: { userId, date: { gte: new Date() } },
        orderBy: { date: 'asc' },
      });
      return events.map(e => ({
        ...e,
        daysUntil: Math.ceil((e.date.getTime() - Date.now()) / 86400000),
      }));
    },
  }),
};
```

### Chat Endpoint (Streaming)

```typescript
// apps/web/src/app/api/chat/route.ts

import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { coachTools, buildSystemPrompt } from '@ai-coach/ai';

export async function POST(req: Request) {
  const { messages, conversationId } = await req.json();
  const user = await getAuthUser(req);

  // Načti kontext pro system prompt
  const context = await buildAgentContext(user.id);
  const systemPrompt = buildSystemPrompt(user, context);

  const result = streamText({
    model: google('gemini-2.5-pro'),
    system: systemPrompt,
    messages,
    tools: coachTools,
    maxSteps: 5,  // Agent může volat max 5 tools v jedné zprávě
    onFinish: async ({ text, usage }) => {
      // Ulož konverzaci do DB
      await saveConversation(conversationId, messages, text, usage);
    },
  });

  return result.toDataStreamResponse();
}
```

### Morning Report Pipeline

```typescript
// apps/worker/src/jobs/morning-report.ts

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { morningReportPrompt } from '@ai-coach/ai';

export async function generateMorningReport(userId: string) {
  // 1. Získej všechna potřebná data
  const [health, plan, calendar, injuries, events] = await Promise.all([
    getLastNightHealth(userId),
    getTodayPlan(userId),
    getTodayCalendar(userId),
    getActiveInjuries(userId),
    getUpcomingEvents(userId),
  ]);

  // 2. Sestav prompt s daty
  const prompt = morningReportPrompt({
    health,
    plan,
    calendar,
    injuries,
    events,
    yesterday: await getYesterdayActivity(userId),
  });

  // 3. Vygeneruj report
  const { text } = await generateText({
    model: google('gemini-2.5-pro'),
    system: buildSystemPrompt(user, context),
    prompt,
  });

  // 4. Ulož report
  await db.dailyReport.create({
    data: {
      userId,
      date: today(),
      report: parseStructuredReport(text),
      markdown: text,
      metricsUsed: { health, plan, calendar },
      aiModel: 'gemini-2.5-pro',
    },
  });

  // 5. Pošli push notifikaci
  await sendPushNotification(userId, {
    title: '🌅 Ranní briefing je ready',
    body: extractSummary(text),
    url: '/dashboard',
  });
}
```

---

## 7. Data Source Integrace

### Garmin Connect (neoficiální)

```typescript
// packages/garmin/src/client.ts
// Použijeme knihovnu garmin-connect (npm)

import { GarminConnect } from 'garmin-connect';

export class GarminClient {
  private gc: GarminConnect;

  async authenticate(email: string, password: string) {
    this.gc = new GarminConnect({ username: email, password });
    await this.gc.login();
  }

  async getSleepData(date: string) {
    return await this.gc.getSleep(date);
  }

  async getHeartRate(date: string) {
    return await this.gc.getHeartRate(date);
  }

  async getTrainingReadiness(date: string) {
    // Training Readiness, HRV Status, Body Battery
    return await this.gc.getUserSummary(date);
  }

  async getActivities(start: string, end: string) {
    return await this.gc.getActivities(0, 50);
    // Filtruj podle datumu
  }

  async getHRV(date: string) {
    return await this.gc.getHRVData(date);
  }
}
```

**⚠️ Garmin limitace:**
- Neoficiální API — může se kdykoliv rozbít
- Nutné ukládat session cookies + refreshovat
- Rate limiting: max 1 request/2 sekundy
- **Řešení:** Sync každé 2 hodiny, cache vše v DB, nikdy nevolej live

### Strava API (oficiální OAuth2)

```typescript
// packages/strava/src/client.ts

export class StravaClient {
  // OAuth2 flow: User → Strava auth → callback s kódem → access token
  // Tokeny se ukládají do DB (User.stravaTokens)

  async getActivities(after: number, perPage = 30) {
    return this.get(`/athlete/activities?after=${after}&per_page=${perPage}`);
  }

  async getDetailedActivity(activityId: string) {
    return this.get(`/activities/${activityId}`);
    // Vrací laps, splits, streams (HR, pace, power, cadence)
  }

  // Strava Webhooks — real-time notifikace o nových aktivitách
  // POST /api/webhooks/strava → trigger sync pro daného uživatele
}
```

### Google Calendar API

```typescript
// packages/calendar/src/client.ts

export class CalendarClient {
  // OAuth2 flow přes Auth.js (NextAuth)
  // Podporuje 2 Google účty (osobní + školní)

  async getEvents(calendarId: string, timeMin: Date, timeMax: Date) {
    const calendar = google.calendar({ version: 'v3', auth: oauthClient });
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    return response.data.items;
  }
}
```

---

## 8. PWA Konfigurace

```json
// apps/web/public/manifest.json
{
  "name": "AI Training Coach",
  "short_name": "Coach",
  "description": "Tvůj osobní AI trenér pro triatlon a běh",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**PWA na iOS:**
- Instalace: Safari → Share → "Add to Home Screen"
- Push notifikace: Fungují od iOS 16.4 (Web Push API)
- Offline: Service Worker cachuje shell + poslední data
- Fullscreen: `display: standalone` = žádný Safari chrome

---

## 9. Railway Deployment

```yaml
# Railway services:

# Service 1: Web (Next.js)
# - Build: npm run build (apps/web)
# - Start: npm run start
# - Port: 3000
# - ENV: DATABASE_URL, REDIS_URL, GOOGLE_AI_KEY, ...

# Service 2: Worker (BullMQ)
# - Build: npm run build (apps/worker)
# - Start: npm run start
# - No port (background only)
# - ENV: same as web

# Service 3: PostgreSQL
# - Railway managed
# - Auto-backups

# Service 4: Redis
# - Railway managed
# - Pro BullMQ job queue
```

**Odhadované náklady (Railway):**
- PostgreSQL: ~$5/měs (Hobby plan)
- Redis: ~$5/měs
- Web service: ~$5/měs (low traffic)
- Worker service: ~$5/měs
- **Celkem: ~$20/měs**

**+ Gemini API:** Free tier = 1,500 req/den (gemini-2.5-pro), pro osobní projekt bohatě stačí.

---

## 10. Plán realizace (fáze)

### Fáze 0: Foundations (1-2 týdny)
- [ ] Inicializace monorepa (Turborepo + TypeScript)
- [ ] Docker Compose (PostgreSQL + Redis pro local dev)
- [ ] Prisma schema + migrace
- [ ] NextAuth.js setup (Google OAuth)
- [ ] Základní Next.js app s Tailwind + shadcn/ui
- [ ] Railway deployment pipeline (CI/CD)
- [ ] PWA manifest + Service Worker

### Fáze 1: Data Pipeline (2-3 týdny)
- [ ] Garmin Connect integrace (login, sync sleep/HR/HRV/activities)
- [ ] Strava OAuth + activity sync + webhooks
- [ ] Google Calendar integrace (2 účty)
- [ ] BullMQ worker setup na Railway
- [ ] Cron joby (garmin-sync, calendar-sync)
- [ ] Parsery: raw data → DB modely

### Fáze 2: Dashboard UI (2-3 týdny)
- [ ] Dashboard overview (dnešní metriky, nadcházející trénink)
- [ ] Health page (grafy: spánek, HRV, Body Battery trendy)
- [ ] Activities page (historie, filtrování, detail aktivity)
- [ ] Calendar view (denní/týdenní přehled)
- [ ] Settings page (propojení účtů, profil, zóny)

### Fáze 3: AI Agent (2-3 týdny)
- [ ] System prompt + fine-tuning na triatlon/běh
- [ ] Tool-use implementace (všech 7+ tools)
- [ ] Chat UI (streaming, markdown rendering, tool call indikátory)
- [ ] Morning report generator
- [ ] Weekly plan generator
- [ ] Push notifikace

### Fáze 4: Training Intelligence (2-3 týdny)
- [ ] Event management (hlavní/vedlejší závody)
- [ ] Injury tracking + AI restrictions
- [ ] Dynamické přizpůsobení plánu
- [ ] Training periodization logic (BASE→BUILD→PEAK→TAPER)
- [ ] Plan compliance tracking

### Fáze 5: Polish & Multi-user (2 týdny)
- [ ] User onboarding flow
- [ ] Pozvánky pro kamarády
- [ ] Performance optimalizace
- [ ] Error handling + monitoring (Sentry)
- [ ] E2E testy kritických flows

**Celkový odhad: 10-14 týdnů** (při full-time práci s AI asistencí výrazně rychleji)

---

## 11. Bezpečnost

- **Garmin heslo:** AES-256-GCM encryption v DB, klíč v ENV
- **OAuth tokeny:** Šifrované v DB, auto-refresh
- **API routes:** Všechny chráněné NextAuth session
- **Rate limiting:** Redis-based na API endpointech
- **CORS:** Pouze vlastní doména
- **CSP headers:** Striktní Content-Security-Policy

---

## 12. Budoucí rozšíření

- **Telegram Bot:** API je ready, stačí přidat bot frontend
- **Apple Health / Health Connect:** Alternativní data source
- **Nutrition tracking:** Propojení s MyFitnessPal API
- **AI Voice Coach:** Text-to-speech pro tréninky (během běhu)
- **Social features:** Sdílení tréninků mezi kamarády
- **Garmin Watch App:** Connect IQ widget s dnešním plánem
