import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ai-coach/db';
import { getMonday, addDays, formatDuration } from '@ai-coach/shared';
import { computePeriodization, getCurrentPhaseInfo } from '@ai-coach/ai';
import { Calendar, Trophy, CheckCircle, Circle } from 'lucide-react';

const SPORT_ICONS: Record<string, string> = { RUN: '🏃', BIKE: '🚴', SWIM: '🏊', STRENGTH: '🏋️', TRIATHLON: '🏅', OTHER: '⚡' };
const INTENSITY_COLORS: Record<string, string> = {
  easy: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  hard: 'bg-red-500/20 text-red-400 border-red-500/30',
  max: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const PHASE_COLORS: Record<string, string> = {
  BASE: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  BUILD: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  PEAK: 'bg-red-500/20 text-red-300 border-red-500/30',
  TAPER: 'bg-green-500/20 text-green-300 border-green-500/30',
  RACE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  RECOVERY: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};

const PHASE_EMOJI: Record<string, string> = {
  BASE: '🏗️', BUILD: '⚡', PEAK: '🔥', TAPER: '🌬️', RACE: '🏆', RECOVERY: '🛌',
};

interface PlannedWorkout {
  id: string;
  sport: string;
  workoutType: string;
  title: string;
  description: string;
  duration: number;
  distance?: number;
  intensity: string;
  completed: boolean;
}

interface DayPlan {
  date: string;
  dayOfWeek: string;
  workouts: PlannedWorkout[];
  isRestDay: boolean;
  notes?: string;
}

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const today = new Date();
  const monday = getMonday(today);

  const [plan, events, mainEvent, userProfile] = await Promise.allSettled([
    prisma.trainingPlan.findFirst({
      where: {
        userId: session.user.id,
        weekStart: { lte: today },
        status: { in: ['ACTIVE', 'DRAFT'] },
      },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.event.findMany({
      where: { userId: session.user.id, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 5,
    }),
    prisma.event.findFirst({
      where: { userId: session.user.id, priority: 'MAIN', date: { gte: today } },
      orderBy: { date: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { weeklyHoursMax: true },
    }),
  ]);

  const planData = plan.status === 'fulfilled' ? plan.value : null;
  const eventsData = events.status === 'fulfilled' ? events.value : [];
  const mainEventData = mainEvent.status === 'fulfilled' ? mainEvent.value : null;
  const userProfileData = userProfile.status === 'fulfilled' ? userProfile.value : null;

  const maxWeeklyHours = (userProfileData as { weeklyHoursMax?: number } | null)?.weeklyHoursMax ?? 10;
  const periodization = computePeriodization(mainEventData?.date ?? null, maxWeeklyHours);
  const phaseInfo = getCurrentPhaseInfo(periodization);

  const weekDays = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
  const planDays = (planData?.plan as { days?: DayPlan[] } | null)?.days ?? [];

  // Build week grid
  const weekGrid = weekDays.map((dayName, i) => {
    const date = addDays(monday, i);
    const isoDate = date.toISOString().split('T')[0]!;
    const dayPlan = planDays.find(d => d.date === isoDate);
    return { dayName, date, isoDate, dayPlan };
  });

  const todayStr = today.toISOString().split('T')[0]!;
  const completed = planDays.flatMap(d => d.workouts).filter(w => w.completed).length;
  const total = planDays.flatMap(d => d.workouts).length;
  const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Suppress unused import warning for formatDuration
  void formatDuration;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-blue-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Tréninkový plán</h1>
      </div>

      {/* Periodization phase badge */}
      {periodization.phases.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${PHASE_COLORS[periodization.currentPhase] ?? ''}`}>
            {PHASE_EMOJI[periodization.currentPhase]} {periodization.currentPhase}
          </span>
          <span className="text-xs text-zinc-400">
            Týden {periodization.currentWeek} · {phaseInfo?.focus}
          </span>
          {periodization.totalWeeks > 0 && (
            <span className="text-xs text-zinc-500 ml-auto">
              {periodization.totalWeeks - periodization.currentWeek + 1} týdnů do závodu
            </span>
          )}
        </div>
      )}

      {/* Compliance */}
      {planData && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Plnění týdne</span>
            <span className="font-medium text-zinc-100">{compliance}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${compliance}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-zinc-400">
            <span>Splněno: {completed}/{total} tréninků</span>
            {planData.plannedHours && <span>Plánováno: {planData.plannedHours}h</span>}
          </div>
        </div>
      )}

      {/* Week grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekGrid.map(({ dayName, date, isoDate, dayPlan }) => {
          const isToday = isoDate === todayStr;
          const isPast = date < today && !isToday;
          return (
            <div
              key={isoDate}
              className={`bg-zinc-900 rounded-xl border p-3 space-y-2 ${isToday ? 'border-blue-500/60' : 'border-zinc-800'} ${isPast ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isToday ? 'text-blue-400' : 'text-zinc-400'}`}>{dayName}</span>
                <span className="text-xs text-zinc-500">{date.getDate()}.{date.getMonth() + 1}.</span>
              </div>

              {!dayPlan ? (
                <p className="text-xs text-zinc-600 italic">—</p>
              ) : dayPlan.isRestDay ? (
                <p className="text-xs text-zinc-500">😴 Odpočinek</p>
              ) : (
                <div className="space-y-1.5">
                  {dayPlan.workouts.map(w => (
                    <div key={w.id} className={`rounded-lg p-2 border ${INTENSITY_COLORS[w.intensity] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{SPORT_ICONS[w.sport] ?? '⚡'}</span>
                        <span className="text-xs font-medium flex-1 truncate">{w.title}</span>
                        {w.completed ? <CheckCircle className="h-3 w-3 shrink-0" /> : <Circle className="h-3 w-3 shrink-0 opacity-40" />}
                      </div>
                      <p className="text-xs opacity-70 mt-0.5">{Math.floor(w.duration / 60)}h{w.duration % 60 > 0 ? ` ${w.duration % 60}min` : ''}</p>
                    </div>
                  ))}
                  {dayPlan.notes && <p className="text-xs text-zinc-500 italic">{dayPlan.notes}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming events */}
      {eventsData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            Nadcházející závody
          </h2>
          <div className="space-y-3">
            {eventsData.map(e => {
              const daysUntil = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000);
              return (
                <div key={e.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{e.name}</p>
                    <p className="text-xs text-zinc-400">{new Date(e.date).toLocaleDateString('cs-CZ')} · {e.sport}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-400">{daysUntil}</p>
                    <p className="text-xs text-zinc-400">dní</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!planData && (
        <div className="text-center py-16 text-zinc-500">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Žádný aktivní plán.</p>
          <p className="text-sm mt-1">AI agent vygeneruje plán po propojení dat.</p>
        </div>
      )}
    </div>
  );
}
