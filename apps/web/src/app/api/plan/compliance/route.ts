import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { getMonday, addDays } from '@ai-coach/shared';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const weekStartParam = req.nextUrl.searchParams.get('weekStart');
    const monday = weekStartParam ? new Date(weekStartParam) : getMonday(new Date());
    const sunday = addDays(monday, 6);

    const plan = await prisma.trainingPlan.findUnique({
      where: { userId_weekStart: { userId: session.user.id, weekStart: monday } },
    });

    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const activities = await prisma.activity.findMany({
      where: {
        userId: session.user.id,
        date: { gte: monday, lte: new Date(sunday.getTime() + 86400000) },
      },
    });

    const planData = plan.plan as { days?: Array<{ date: string; isRestDay: boolean; workouts: Array<{ id: string; sport: string; duration: number; completed: boolean }> }> } | null;
    const days = planData?.days ?? [];

    const complianceData = days.map(day => {
      const dayActivities = activities.filter(a => {
        const actDate = a.date.toISOString().split('T')[0];
        return actDate === day.date;
      });

      const workouts = day.workouts.map(w => {
        const match = dayActivities.find(a => a.sport === w.sport);
        const status: 'completed' | 'missed' = (w.completed || !!match) ? 'completed' : 'missed';
        return {
          ...w,
          status,
          actualActivityId: match?.id,
          actualDuration: match?.duration,
        };
      });

      return { ...day, workouts, actualActivities: dayActivities.length };
    });

    const totalWorkouts = complianceData.flatMap(d => d.workouts).length;
    const completedWorkouts = complianceData.flatMap(d => d.workouts).filter(w => w.status === 'completed').length;
    const compliance = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

    return NextResponse.json({
      weekStart: monday.toISOString().split('T')[0],
      days: complianceData,
      totalWorkouts,
      completedWorkouts,
      compliance,
      plannedHours: plan.plannedHours,
      actualHours: activities.reduce((s, a) => s + a.duration, 0) / 3600,
    });
  } catch (err) {
    console.error('[api/plan/compliance] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
