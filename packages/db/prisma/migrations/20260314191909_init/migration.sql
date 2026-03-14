-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('RUN', 'BIKE', 'SWIM', 'TRIATHLON', 'STRENGTH', 'OTHER');

-- CreateEnum
CREATE TYPE "EventPriority" AS ENUM ('MAIN', 'SECONDARY', 'TRAINING');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('GARMIN', 'STRAVA', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ADJUSTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InjurySeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('EASY', 'TEMPO', 'INTERVAL', 'LONG_RUN', 'RECOVERY', 'RACE_PACE', 'BRICK', 'OPEN_WATER', 'STRENGTH', 'REST');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Prague',
    "maxHR" INTEGER,
    "restHR" INTEGER,
    "ftp" INTEGER,
    "thresholdPace" INTEGER,
    "swimCSS" INTEGER,
    "weeklyHoursMax" DOUBLE PRECISION,
    "garminEmail" TEXT,
    "garminPassword" TEXT,
    "stravaTokens" JSONB,
    "googleTokens" JSONB,
    "googleTokens2" JSONB,
    "pushSubscription" JSONB,
    "morningReportTime" TEXT NOT NULL DEFAULT '06:00',
    "preferredUnits" TEXT NOT NULL DEFAULT 'metric',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "priority" "EventPriority" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "distance" DOUBLE PRECISION,
    "swimDist" DOUBLE PRECISION,
    "bikeDist" DOUBLE PRECISION,
    "runDist" DOUBLE PRECISION,
    "targetTime" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "DataSource" NOT NULL,
    "externalId" TEXT,
    "sport" "Sport" NOT NULL,
    "workoutType" "WorkoutType",
    "name" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "distance" DOUBLE PRECISION,
    "avgHR" INTEGER,
    "maxHR" INTEGER,
    "avgPace" DOUBLE PRECISION,
    "avgPower" INTEGER,
    "normalizedPower" INTEGER,
    "trainingLoad" DOUBLE PRECISION,
    "calories" INTEGER,
    "elevationGain" DOUBLE PRECISION,
    "avgCadence" INTEGER,
    "poolLength" INTEGER,
    "swolf" DOUBLE PRECISION,
    "laps" JSONB,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sleepScore" INTEGER,
    "sleepDuration" INTEGER,
    "deepSleep" INTEGER,
    "remSleep" INTEGER,
    "lightSleep" INTEGER,
    "awakeDuration" INTEGER,
    "sleepStart" TIMESTAMP(3),
    "sleepEnd" TIMESTAMP(3),
    "restingHR" INTEGER,
    "hrvStatus" DOUBLE PRECISION,
    "hrvBaseline" DOUBLE PRECISION,
    "bodyBattery" INTEGER,
    "bodyBatteryChange" INTEGER,
    "stressScore" INTEGER,
    "trainingReadiness" INTEGER,
    "vo2max" DOUBLE PRECISION,
    "spo2Avg" DOUBLE PRECISION,
    "spo2Min" DOUBLE PRECISION,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "targetEventId" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "plan" JSONB NOT NULL,
    "adjustments" JSONB,
    "plannedHours" DOUBLE PRECISION,
    "plannedTSS" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "actualTSS" DOUBLE PRECISION,
    "compliance" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "report" JSONB NOT NULL,
    "markdown" TEXT NOT NULL,
    "metricsUsed" JSONB NOT NULL,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "injuries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "InjurySeverity" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "restrictions" JSONB,
    "progressNotes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "injuries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "messages" JSONB NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "events_userId_date_idx" ON "events"("userId", "date");

-- CreateIndex
CREATE INDEX "activities_userId_date_idx" ON "activities"("userId", "date");

-- CreateIndex
CREATE INDEX "activities_userId_sport_date_idx" ON "activities"("userId", "sport", "date");

-- CreateIndex
CREATE UNIQUE INDEX "activities_source_externalId_key" ON "activities"("source", "externalId");

-- CreateIndex
CREATE INDEX "health_metrics_userId_date_idx" ON "health_metrics"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "health_metrics_userId_date_key" ON "health_metrics"("userId", "date");

-- CreateIndex
CREATE INDEX "calendar_events_userId_startTime_endTime_idx" ON "calendar_events"("userId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_source_externalId_key" ON "calendar_events"("source", "externalId");

-- CreateIndex
CREATE INDEX "training_plans_userId_status_idx" ON "training_plans"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "training_plans_userId_weekStart_key" ON "training_plans"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_userId_date_key" ON "daily_reports"("userId", "date");

-- CreateIndex
CREATE INDEX "injuries_userId_active_idx" ON "injuries"("userId", "active");

-- CreateIndex
CREATE INDEX "conversations_userId_updatedAt_idx" ON "conversations"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
