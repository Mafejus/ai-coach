// apps/web/src/app/actions/weekly-review.ts

"use server";

import { prisma } from "@ai-coach/db";
import { auth } from "@/lib/auth";
import { generateWeeklyReviewPrompt } from "@/lib/prompts/weekly-review-prompt";
import { WeeklyAIReview, WeeklyExportPayload } from "@/types/weekly-review";
import { subDays, startOfWeek, endOfWeek, addDays, startOfDay } from "date-fns";

export async function generateExportForGemini() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  const userId = session.user.id;
  const today = new Date();
  const periodStart = subDays(startOfDay(today), 14);
  
  const [
    user,
    healthMetrics,
    recentActivities,
    calendarEvents,
    injuries,
    previousReview
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.healthMetric.findMany({
      where: { userId, date: { gte: periodStart } },
      orderBy: { date: "asc" }
    }),
    prisma.activity.findMany({
      where: { userId, date: { gte: periodStart } },
      orderBy: { date: "desc" },
      take: 20
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: periodStart } },
      orderBy: { startTime: "asc" }
    }),
    prisma.injury.findMany({
      where: { userId, active: true }
    }),
    prisma.weeklyReview.findFirst({
      where: { userId },
      orderBy: { weekStart: "desc" }
    })
  ]);
  
  const payload: WeeklyExportPayload = {
    exportDate: today.toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: today.toISOString(),
    userProfile: {
      name: user.name,
      restingHR: user.restHR,
      maxHR: user.maxHR,
      currentFTP: user.ftp,
      thresholdPace: user.thresholdPace,
      swimCSS: user.swimCSS,
      weeklyHoursMax: user.weeklyHoursMax,
    },
    activeInjuries: injuries.map((i: any) => ({
      id: i.id,
      bodyPart: i.bodyPart,
      severity: i.severity,
      description: i.description,
      startDate: i.startDate.toISOString(),
      restrictions: i.restrictions,
    })),
    healthMetrics: healthMetrics.map((h: any) => ({
      date: h.date.toISOString().split('T')[0],
      sleep: {
        score: h.sleepScore,
        duration: h.sleepDuration,
        deep: h.deepSleep,
        rem: h.remSleep,
        light: h.lightSleep,
        awake: h.awakeDuration,
        start: h.sleepStart?.toISOString() ?? null,
        end: h.sleepEnd?.toISOString() ?? null,
      },
      recovery: {
        restingHR: h.restingHR,
        hrvStatus: h.hrvStatus,
        hrvBaseline: h.hrvBaseline,
        bodyBattery: h.bodyBattery,
        bodyBatteryChange: h.bodyBatteryChange,
        trainingReadiness: h.trainingReadiness,
        stressScore: h.stressScore,
        vo2max: h.vo2max,
      }
    })),
    activities: recentActivities.map((a: any) => ({
      id: a.id,
      date: a.date.toISOString(),
      sport: a.sport,
      name: a.name,
      duration: a.duration,
      distance: a.distance,
      avgHR: a.avgHR,
      maxHR: a.maxHR,
      avgPace: a.avgPace,
      avgPower: a.avgPower,
      trainingLoad: a.trainingLoad,
      calories: a.calories,
      elevationGain: a.elevationGain,
      laps: a.laps,
      aerobicTE: (a.rawData as any)?.garminRaw?.aerobicTrainingEffect ?? (a.rawData as any)?.aerobicTrainingEffect,
      anaerobicTE: (a.rawData as any)?.garminRaw?.anaerobicTrainingEffect ?? (a.rawData as any)?.anaerobicTrainingEffect,
    })),
    calendarEvents: calendarEvents.map((e: any) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      isAllDay: e.isAllDay,
      location: e.location,
      category: e.category,
    })),
    previousReview: previousReview ? {
      date: previousReview.weekStart.toISOString(),
      coachDirectives: previousReview.coachDirectives,
      focusAreas: previousReview.focusAreas,
    } : null,
  };
  
  const prompt = generateWeeklyReviewPrompt(payload);
  
  return {
    payload,
    prompt,
    tokenEstimate: Math.ceil(prompt.length / 4)
  };
}

export async function importGeminiReview(rawJson: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  const userId = session.user.id;
  
  // Clean JSON if it has markdown backticks
  const cleanedJson = rawJson.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
  
  let review: WeeklyAIReview;
  try {
    review = JSON.parse(cleanedJson);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
  
  const weekStart = startOfWeek(new Date(review.trainingPlan.weekStart), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create/Update WeeklyReview
    const weeklyReview = await tx.weeklyReview.upsert({
      where: {
        userId_weekStart: { userId, weekStart }
      },
      create: {
        userId,
        weekStart,
        weekEnd,
        geminiResponse: review as any,
        exportedData: {} as any, // We don't save exported data here for simplicity, or we could pass it
        overtrainingRisk: review.healthAndLoad.overtrainingRisk,
        recoveryStatus: review.healthAndLoad.recoveryStatus,
        coachDirectives: review.coachDirectives,
        focusAreas: review.focusAreasNextWeek,
        totalPlannedMinutes: review.trainingPlan.totalPlannedMinutes,
        appliedAt: new Date()
      },
      update: {
        geminiResponse: review as any,
        overtrainingRisk: review.healthAndLoad.overtrainingRisk,
        recoveryStatus: review.healthAndLoad.recoveryStatus,
        coachDirectives: review.coachDirectives,
        focusAreas: review.focusAreasNextWeek,
        totalPlannedMinutes: review.trainingPlan.totalPlannedMinutes,
        appliedAt: new Date()
      }
    });
    
    // 2. Delete old planned workouts for this week
    await tx.plannedWorkout.deleteMany({
      where: {
        userId,
        date: { gte: weekStart, lte: weekEnd }
      }
    });
    
    // 3. Create new planned workouts
    const workoutsToCreate = review.trainingPlan.days.map((day: any) => ({
      userId,
      weeklyReviewId: weeklyReview.id,
      date: new Date(day.date),
      dayOfWeek: day.dayOfWeek,
      isRestDay: day.isRestDay,
      workoutType: day.primaryWorkout?.type,
      subType: day.primaryWorkout?.subType,
      title: day.primaryWorkout?.title,
      durationMinutes: day.primaryWorkout?.durationMinutes,
      description: day.primaryWorkout?.description,
      targetZones: day.primaryWorkout?.targetZones,
      targetPace: day.primaryWorkout?.targetPace,
      targetPower: day.primaryWorkout?.targetPower,
      targetHR: day.primaryWorkout?.targetHR,
      warmup: day.primaryWorkout?.warmup,
      mainSet: day.primaryWorkout?.mainSet,
      cooldown: day.primaryWorkout?.cooldown,
      coachNotes: day.primaryWorkout?.coachNotes,
      recoveryPlan: day.recovery as any,
      dayContext: day.dayContext,
      nutritionFocus: day.nutritionFocus
    }));
    
    await tx.plannedWorkout.createMany({ data: workoutsToCreate });
    
    // 4. Update user metrics
    if (review.metricUpdates) {
      const updates: any = {};
      if (review.metricUpdates.suggestedMaxHR) updates.maxHR = review.metricUpdates.suggestedMaxHR;
      if (review.metricUpdates.suggestedThresholdPace) updates.thresholdPace = review.metricUpdates.suggestedThresholdPace;
      if (review.metricUpdates.suggestedFtp) updates.ftp = review.metricUpdates.suggestedFtp;
      
      if (Object.keys(updates).length > 0) {
        await tx.user.update({ where: { id: userId }, data: updates });
      }
    }
    
    // 5. Update ActiveCoachContext
    await tx.activeCoachContext.upsert({
      where: { userId },
      create: {
        userId,
        coachDirectives: review.coachDirectives,
        focusAreas: review.focusAreasNextWeek,
        injuryWarnings: review.healthAndLoad.injuryWarnings,
        overtrainingRisk: review.healthAndLoad.overtrainingRisk,
        recoveryStatus: review.healthAndLoad.recoveryStatus,
        hrvTrend: review.healthAndLoad.hrvTrend,
        sourceReviewId: weeklyReview.id,
        sourceReviewDate: new Date(),
        validUntil: addDays(weekEnd, 1)
      },
      update: {
        coachDirectives: review.coachDirectives,
        focusAreas: review.focusAreasNextWeek,
        injuryWarnings: review.healthAndLoad.injuryWarnings,
        overtrainingRisk: review.healthAndLoad.overtrainingRisk,
        recoveryStatus: review.healthAndLoad.recoveryStatus,
        hrvTrend: review.healthAndLoad.hrvTrend,
        sourceReviewId: weeklyReview.id,
        sourceReviewDate: new Date(),
        validUntil: addDays(weekEnd, 1)
      }
    });
    
    return weeklyReview;
  });
  
  return {
    success: true,
    reviewId: result.id,
    workoutsCreated: review.trainingPlan.days.length,
  };
}
