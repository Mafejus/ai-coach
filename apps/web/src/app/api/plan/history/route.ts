import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const weeks = parseInt(req.nextUrl.searchParams.get('weeks') ?? '12');

    const plans = await prisma.trainingPlan.findMany({
      where: { userId: session.user.id },
      orderBy: { weekStart: 'desc' },
      take: weeks,
      select: {
        id: true, weekStart: true, status: true,
        plannedHours: true, actualHours: true, compliance: true,
        plan: true,
      },
    });

    return NextResponse.json(plans.map(p => ({
      ...p,
      weekStart: p.weekStart.toISOString().split('T')[0],
    })));
  } catch (err) {
    console.error('[api/plan/history] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
