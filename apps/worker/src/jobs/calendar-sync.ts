import type { Job } from 'bullmq';
import { prisma } from '@ai-coach/db';
import { CalendarClient } from '@ai-coach/calendar';
import { classifyEventCategory } from '@ai-coach/calendar';
import { addDays } from '@ai-coach/shared';

interface CalendarSyncJobData {
  userId: string;
  daysAhead?: number;
}

export async function calendarSyncJob(job: Job<CalendarSyncJobData>): Promise<void> {
  const { userId, daysAhead = 30 } = job.data;
  console.log(`[${new Date().toISOString()}] [calendar-sync] Starting for user ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleTokens: true, googleTokens2: true },
  });

  if (!user?.googleTokens) {
    console.log(`[calendar-sync] No Google tokens for user ${userId}, skipping`);
    return;
  }

  const timeMin = new Date();
  const timeMax = addDays(new Date(), daysAhead);

  const accounts = [
    { tokens: user.googleTokens, source: 'google_primary' },
    ...(user.googleTokens2 ? [{ tokens: user.googleTokens2, source: 'google_school' }] : []),
  ];

  for (const account of accounts) {
    const tokens = account.tokens as {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    };

    try {
      let currentTokens = tokens;
      if (Date.now() >= tokens.expiresAt - 300_000) {
        currentTokens = await CalendarClient.refreshTokens(
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!,
          tokens.refreshToken,
        );
        const updateData = account.source === 'google_primary'
          ? { googleTokens: currentTokens }
          : { googleTokens2: currentTokens };
        await prisma.user.update({ where: { id: userId }, data: updateData });
      }

      const client = new CalendarClient(currentTokens, account.source);
      const events = await client.getEvents('primary', timeMin, timeMax);
      let count = 0;

      for (const event of events) {
        const category = classifyEventCategory(event.title, event.description);
        await prisma.calendarEvent.upsert({
          where: { source_externalId: { source: event.source, externalId: event.externalId } },
          update: {
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            location: event.location ?? null,
            category,
          },
          create: {
            userId,
            source: event.source,
            externalId: event.externalId,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            location: event.location ?? null,
            category,
          },
        });
        count++;
      }
      console.log(`[calendar-sync] ${count} events synced for ${account.source}`);
    } catch (err) {
      console.error(`[calendar-sync] Error for ${account.source}:`, err);
    }
  }

  await job.updateProgress(100);
  console.log(`[${new Date().toISOString()}] [calendar-sync] Completed for user ${userId}`);
}
