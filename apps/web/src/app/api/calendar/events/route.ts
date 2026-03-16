import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const events = await prisma.calendarEvent.findMany({
    where: {
      userId: session.user.id,
      ...(from && { startTime: { gte: new Date(from) } }),
      ...(to && { endTime: { lte: new Date(to) } }),
    },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json(events);
}
