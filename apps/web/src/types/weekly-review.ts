// apps/web/src/types/weekly-review.ts

export interface WeeklyExportPayload {
  exportDate: string; // ISO date
  periodStart: string; // 14 dní zpět
  periodEnd: string;
  
  userProfile: {
    name: string;
    age?: number;
    restingHR?: number | null;
    maxHR?: number | null;
    currentFTP?: number | null;
    thresholdPace?: number | null;
    swimCSS?: number | null;
    weeklyHoursMax?: number | null;
    primaryGoal?: string;
  };

  activeInjuries: Array<{
    id: string;
    bodyPart: string;
    severity: string;
    description: string;
    startDate: string;
    restrictions: any;
    notes?: string;
  }>;

  healthMetrics: Array<{
    date: string;
    sleep?: {
      score: number | null;
      duration: number | null;
      deep: number | null;
      rem: number | null;
      light: number | null;
      awake: number | null;
      start: string | null;
      end: string | null;
    };
    recovery: {
      restingHR: number | null;
      hrvStatus: number | null;
      hrvBaseline: number | null;
      bodyBattery: number | null;
      bodyBatteryChange: number | null;
      trainingReadiness: number | null;
      stressScore: number | null;
      vo2max: number | null;
    };
  }>;

  activities: Array<{
    id: string;
    date: string;
    sport: string;
    name: string | null;
    duration: number;
    distance: number | null;
    avgHR: number | null;
    maxHR: number | null;
    avgPace: number | null;
    avgPower: number | null;
    trainingLoad: number | null;
    calories: number | null;
    elevationGain: number | null;
    laps: any;
    aerobicTE?: number | null;
    anaerobicTE?: number | null;
  }>;

  calendarEvents: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    location?: string | null;
    category?: string | null;
  }>;

  previousReview?: {
    date: string;
    coachDirectives: string;
    focusAreas: string[];
  } | null;
}

export interface WeeklyAIReview {
  reviewDate: string;
  
  progressAnalysis: {
    strengths: string[];
    weaknesses: string[];
    weeklyHighlight: string;
    generalFeedback: string;
    comparedToLastWeek: string;
  };
  
  healthAndLoad: {
    overtrainingRisk: "LOW" | "MEDIUM" | "HIGH";
    riskExplanation: string;
    injuryWarnings: string[];
    recoveryStatus: "FRESH" | "RECOVERING" | "FATIGUED" | "OVERREACHED";
    sleepQualityAssessment: string;
    hrvTrend: "IMPROVING" | "STABLE" | "DECLINING";
    actionableAdvice: string[];
  };
  
  metricUpdates: {
    suggestedMaxHR?: number;
    suggestedThresholdPace?: number;
    suggestedFtp?: number;
    suggestedSwimPace?: number;
    zoneAdjustments?: string;
    reasoning: string;
  };
  
  coachDirectives: string;
  focusAreasNextWeek: string[];
  
  trainingPlan: {
    weekStart: string;
    weekEnd: string;
    phase: "BASE" | "BUILD" | "PEAK" | "TAPER" | "RECOVERY";
    totalPlannedMinutes: number;
    totalPlannedTSS: number;
    weeklyFocus: string;
    
    days: Array<{
      date: string;
      dayOfWeek: string;
      isRestDay: boolean;
      primaryWorkout?: {
        type: "RUN" | "RIDE" | "SWIM" | "STRENGTH" | "BRICK";
        subType: string;
        title: string;
        durationMinutes: number;
        description: string;
        targetZones: string;
        targetPace?: string;
        targetPower?: string;
        targetHR?: string;
        warmup?: string;
        mainSet?: string;
        cooldown?: string;
        coachNotes?: string;
      };
      secondaryWorkout?: {
        type: "STRENGTH" | "SWIM" | "RUN" | "RIDE";
        title: string;
        durationMinutes: number;
        description: string;
      };
      recovery?: {
        mobilityMinutes?: number;
        stretchingMinutes?: number;
        notes?: string;
      };
      dayContext?: string;
      nutritionFocus?: string;
    }>;
  };
  
  longTermOutlook: {
    progressTowardsGoal: number;
    estimatedReadiness: string;
    suggestedAdjustments?: string[];
    motivationalNote: string;
  };
}
