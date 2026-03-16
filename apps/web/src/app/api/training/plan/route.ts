import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const weekStart = req.nextUrl.searchParams.get('weekStart');

  let plan;
  if (weekStart) {
    plan = await prisma.trainingPlan.findUnique({
      where: {
        userId_weekStart: { userId: session.user.id, weekStart: new Date(weekStart) },
      },
    });
  } else {
    const today = new Date();
    plan = await prisma.trainingPlan.findFirst({
      where: {
        userId: session.user.id,
        weekStart: { lte: today },
        status: { in: ['ACTIVE', 'DRAFT'] },
      },
      orderBy: { weekStart: 'desc' },
    });
  }

  if (!plan) return NextResponse.json(null);

  return NextResponse.json(plan);
}
