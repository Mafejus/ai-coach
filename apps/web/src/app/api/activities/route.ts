import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import type { Sport, DataSource } from '@ai-coach/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const sport = req.nextUrl.searchParams.get('sport');
  const source = req.nextUrl.searchParams.get('source');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);

  const activities = await prisma.activity.findMany({
    where: {
      userId: session.user.id,
      ...(from && { date: { gte: new Date(from) } }),
      ...(to && { date: { lte: new Date(to) } }),
      ...(sport && sport !== 'ALL' && { sport: sport as Sport }),
      ...(source && source !== 'ALL' && { source: source as DataSource }),
    },
    orderBy: { date: 'desc' },
    take: limit,
  });

  return NextResponse.json(activities);
}
