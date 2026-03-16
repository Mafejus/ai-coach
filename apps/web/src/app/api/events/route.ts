import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import type { Sport, EventPriority } from '@ai-coach/db';
import { z } from 'zod';

const EventSchema = z.object({
  name: z.string().min(1),
  sport: z.enum(['RUN', 'BIKE', 'SWIM', 'TRIATHLON', 'STRENGTH', 'OTHER']),
  priority: z.enum(['MAIN', 'SECONDARY', 'TRAINING']),
  date: z.string(),
  distance: z.number().optional(),
  swimDist: z.number().optional(),
  bikeDist: z.number().optional(),
  runDist: z.number().optional(),
  targetTime: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const events = await prisma.event.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(
      events.map(e => ({
        ...e,
        daysUntil: Math.ceil((e.date.getTime() - Date.now()) / 86400000),
      })),
    );
  } catch (err) {
    console.error('[api/events] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as unknown;
    const parsed = EventSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });

    const event = await prisma.event.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        sport: parsed.data.sport as Sport,
        priority: parsed.data.priority as EventPriority,
        date: new Date(parsed.data.date),
        distance: parsed.data.distance,
        swimDist: parsed.data.swimDist,
        bikeDist: parsed.data.bikeDist,
        runDist: parsed.data.runDist,
        targetTime: parsed.data.targetTime,
        notes: parsed.data.notes,
      },
    });

    return NextResponse.json({ ...event, daysUntil: Math.ceil((event.date.getTime() - Date.now()) / 86400000) }, { status: 201 });
  } catch (err) {
    console.error('[api/events] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
