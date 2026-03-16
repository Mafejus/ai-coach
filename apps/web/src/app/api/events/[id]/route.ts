import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import type { Sport, EventPriority } from '@ai-coach/db';
import { z } from 'zod';

const EventUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  sport: z.enum(['RUN', 'BIKE', 'SWIM', 'TRIATHLON', 'STRENGTH', 'OTHER']).optional(),
  priority: z.enum(['MAIN', 'SECONDARY', 'TRAINING']).optional(),
  date: z.string().optional(),
  distance: z.number().nullable().optional(),
  swimDist: z.number().nullable().optional(),
  bikeDist: z.number().nullable().optional(),
  runDist: z.number().nullable().optional(),
  targetTime: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json() as unknown;
    const parsed = EventUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...parsed.data,
        sport: parsed.data.sport as Sport | undefined,
        priority: parsed.data.priority as EventPriority | undefined,
        date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      },
    });

    return NextResponse.json({ ...updated, daysUntil: Math.ceil((updated.date.getTime() - Date.now()) / 86400000) });
  } catch (err) {
    console.error('[api/events/[id]] PUT error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/events/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
