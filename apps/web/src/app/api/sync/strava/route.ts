import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, Prisma } from '@ai-coach/db';
import type { Sport } from '@ai-coach/db';
import { StravaClient } from '@ai-coach/strava';
import { parseStravaActivity } from '@ai-coach/strava';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { stravaTokens: true },
  });

  if (!user.stravaTokens) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
  }

  const tokens = user.stravaTokens as {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    athleteId: number;
  };

  try {
    let currentTokens = tokens;

    // Refresh if expired
    if (Date.now() >= tokens.expiresAt - 300_000) {
      const refreshed = await StravaClient.refreshTokens(
        process.env.STRAVA_CLIENT_ID!,
        process.env.STRAVA_CLIENT_SECRET!,
        tokens.refreshToken,
      );
      currentTokens = { ...tokens, ...refreshed };
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stravaTokens: currentTokens },
      });
    }

    const client = new StravaClient(currentTokens);

    // Get last synced activity date
    const lastActivity = await prisma.activity.findFirst({
      where: { userId: session.user.id, source: 'STRAVA' },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    const after = lastActivity
      ? Math.floor(lastActivity.date.getTime() / 1000) - 86400 // 1 day overlap
      : Math.floor((Date.now() - 30 * 86400_000) / 1000); // last 30 days

    const activities = await client.getActivities(after);
    let count = 0;

    const STRAVA_CUTOFF = new Date('2026-03-06T23:59:59Z');

    for (const raw of activities) {
      try {
        // Skip Strava activities after cutoff — Garmin is primary source from that date on
        if (new Date(raw.start_date as string) > STRAVA_CUTOFF) continue;

        const parsed = parseStravaActivity(raw);
        const data = {
          ...parsed,
          sport: parsed.sport as Sport,
          laps: parsed.laps != null ? (parsed.laps as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          rawData: (parsed.rawData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          userId: session.user.id,
        };
        await prisma.activity.upsert({
          where: { source_externalId: { source: 'STRAVA', externalId: parsed.externalId } },
          update: data,
          create: data,
        });
        count++;
      } catch (err) {
        console.error('[sync/strava] Activity upsert error:', err);
      }
    }

    return NextResponse.json({
      success: true,
      activitiesUpdated: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sync/strava] Error:', err);
    return NextResponse.json({ error: 'Sync failed', details: String(err) }, { status: 500 });
  }
}
