import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { z } from 'zod';

const ProfileSchema = z.object({
  name: z.string().min(1).optional(),
  maxHR: z.number().int().min(100).max(250).optional().nullable(),
  restHR: z.number().int().min(30).max(100).optional().nullable(),
  ftp: z.number().int().min(50).max(600).optional().nullable(),
  thresholdPace: z.number().int().min(120).max(600).optional().nullable(),
  swimCSS: z.number().int().min(40).max(200).optional().nullable(),
  weeklyHoursMax: z.number().min(1).max(40).optional().nullable(),
  timezone: z.string().optional(),
  morningReportTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: { id: true, name: true, maxHR: true, restHR: true, ftp: true, thresholdPace: true, swimCSS: true, weeklyHoursMax: true, timezone: true, morningReportTime: true },
  });

  return NextResponse.json(user);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, maxHR: true, restHR: true, ftp: true, thresholdPace: true, swimCSS: true, weeklyHoursMax: true, timezone: true, morningReportTime: true },
  });

  return NextResponse.json(user);
}
