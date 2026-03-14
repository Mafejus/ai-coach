import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@ai-coach/db';
import { verifyWebhookChallenge, parseWebhookEvent, isActivityEvent } from '@ai-coach/strava';

// GET: Strava webhook subscription verification
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const result = verifyWebhookChallenge(
    token,
    process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? '',
    challenge,
  );

  if (!result) {
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
  }

  return NextResponse.json(result);
}

// POST: Incoming Strava event
export async function POST(req: NextRequest) {
  const body = await req.json();
  const event = parseWebhookEvent(body);

  if (!event || !isActivityEvent(event)) {
    return NextResponse.json({ received: true });
  }

  if (event.aspect_type === 'create' || event.aspect_type === 'update') {
    // Find user by Strava athleteId (filter in JS — Prisma JSON nullable filter limitation)
    const users = await prisma.user.findMany({
      select: { id: true, stravaTokens: true },
    });

    for (const user of users) {
      const tokens = user.stravaTokens as { athleteId?: number } | null;
      if (tokens?.athleteId === event.owner_id) {
        // TODO: Trigger BullMQ job in Phase 1 worker
        console.log(`[webhook/strava] Activity ${event.object_id} for user ${user.id}, queuing sync`);
        break;
      }
    }
  }

  return NextResponse.json({ received: true });
}
