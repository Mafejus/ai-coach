import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { CalendarClient } from '@ai-coach/calendar';
import { classifyEventCategory } from '@ai-coach/calendar';
import { addDays } from '@ai-coach/shared';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { googleTokens: true, googleTokens2: true },
  });

  if (!user.googleTokens) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
  }

  const timeMin = new Date();
  const timeMax = addDays(new Date(), 30);
  let count = 0;

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

      // Refresh if expired
      if (Date.now() >= tokens.expiresAt - 300_000) {
        currentTokens = await CalendarClient.refreshTokens(
          process.env.GOOGLE_CLIENT_ID!,
          process.env.GOOGLE_CLIENT_SECRET!,
          tokens.refreshToken,
        );
        const updateData = account.source === 'google_primary'
          ? { googleTokens: currentTokens }
          : { googleTokens2: currentTokens };
        await prisma.user.update({ where: { id: session.user.id }, data: updateData });
      }

      const client = new CalendarClient(currentTokens, account.source);
      const events = await client.getEvents('primary', timeMin, timeMax);

      for (const event of events) {
        try {
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
              userId: session.user.id,
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
        } catch (err) {
          console.error('[sync/calendar] Event upsert error:', err);
        }
      }
    } catch (err) {
      console.error(`[sync/calendar] Error for ${account.source}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    eventsUpdated: count,
    timestamp: new Date().toISOString(),
  });
}
