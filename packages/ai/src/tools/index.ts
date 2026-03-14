import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@ai-coach/db';
import { getMonday } from '@ai-coach/shared';

// UserId is injected at runtime via closure
export function createCoachTools(userId: string) {
  return {
    getHealthMetrics: tool({
      description:
        'Získej zdravotní metriky (spánek, HRV, Body Battery, Training Readiness) za zadané období',
      parameters: z.object({
        startDate: z.string().describe('ISO date (YYYY-MM-DD)'),
        endDate: z.string().describe('ISO date (YYYY-MM-DD)'),
      }),
      execute: async ({ startDate, endDate }) => {
        return await prisma.healthMetric.findMany({
          where: {
            userId,
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          orderBy: { date: 'desc' },
        });
      },
    }),

    getActivities: tool({
      description: 'Získej historii tréninků. Lze filtrovat podle sportu a období.',
      parameters: z.object({
        startDate: z.string().describe('ISO date (YYYY-MM-DD)'),
        endDate: z.string().describe('ISO date (YYYY-MM-DD)'),
        sport: z.enum(['RUN', 'BIKE', 'SWIM', 'TRIATHLON', 'STRENGTH', 'OTHER']).optional(),
        limit: z.number().default(20),
      }),
      execute: async ({ startDate, endDate, sport, limit }) => {
        return await prisma.activity.findMany({
          where: {
            userId,
            date: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
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
        startDate: z.string().describe('ISO date (YYYY-MM-DD)'),
        endDate: z.string().describe('ISO date (YYYY-MM-DD)'),
      }),
      execute: async ({ startDate, endDate }) => {
        return await prisma.calendarEvent.findMany({
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
        weekStart: z
          .string()
          .optional()
          .describe('ISO date pondělí (YYYY-MM-DD). Default = tento týden.'),
      }),
      execute: async ({ weekStart }) => {
        const monday = weekStart ? new Date(weekStart) : getMonday(new Date());
        return await prisma.trainingPlan.findUnique({
          where: { userId_weekStart: { userId, weekStart: monday } },
        });
      },
    }),

    updateTrainingPlan: tool({
      description: 'Uprav tréninkový plán — přesuň trénink, změň intenzitu, nahraď cvičení',
      parameters: z.object({
        weekStart: z.string().describe('ISO date pondělí (YYYY-MM-DD)'),
        changes: z.object({
          date: z.string().describe('ISO date (YYYY-MM-DD)'),
          action: z.enum(['modify', 'skip', 'swap', 'add', 'move']),
          workoutId: z.string().optional(),
          newWorkout: z.unknown().optional(),
          moveToDate: z.string().optional(),
          reason: z.string(),
        }),
      }),
      execute: async ({ weekStart, changes }) => {
        // TODO: Implement plan update logic
        console.log('updateTrainingPlan called', { weekStart, changes });
        return { success: true, message: 'Plan update not yet implemented' };
      },
    }),

    logInjury: tool({
      description: 'Zaznamenej nové zranění nebo aktualizuj existující',
      parameters: z.object({
        bodyPart: z.string().describe('Část těla (např. "left_achilles", "right_knee")'),
        description: z.string().describe('Popis zranění'),
        severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
      }),
      execute: async ({ bodyPart, description, severity }) => {
        // TODO: Implement injury logging + AI restriction generation
        return await prisma.injury.create({
          data: {
            userId,
            bodyPart,
            description,
            severity,
            startDate: new Date(),
            active: true,
          },
        });
      },
    }),

    getActiveInjuries: tool({
      description: 'Získej seznam aktivních zranění a jejich omezení',
      parameters: z.object({}),
      execute: async () => {
        return await prisma.injury.findMany({
          where: { userId, active: true },
        });
      },
    }),

    getEventCountdown: tool({
      description: 'Získej odpočet dní do cílových závodů',
      parameters: z.object({}),
      execute: async () => {
        const events = await prisma.event.findMany({
          where: { userId, date: { gte: new Date() } },
          orderBy: { date: 'asc' },
        });
        return events.map((e) => ({
          ...e,
          daysUntil: Math.ceil((e.date.getTime() - Date.now()) / 86400000),
        }));
      },
    }),
  };
}
