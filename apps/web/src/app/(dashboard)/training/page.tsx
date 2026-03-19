import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ai-coach/db';
import { getMonday, addDays, toISODate } from '@ai-coach/shared';
import { computePeriodization, getCurrentPhaseInfo } from '@ai-coach/ai';
import { 
  Calendar, 
  Trophy, 
  CheckCircle, 
  Circle, 
  Brain, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Zap,
  Activity,
  Heart
} from 'lucide-react';

const SPORT_ICONS: Record<string, string> = { RUN: '🏃', BIKE: '🚴', SWIM: '🏊', STRENGTH: '🏋️', TRIATHLON: '🏅', OTHER: '⚡' };
const INTENSITY_COLORS: Record<string, string> = {
  easy: 'bg-green-500/20 text-green-400 border-green-500/30',
  moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  hard: 'bg-red-500/20 text-red-400 border-red-500/30',
  max: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-green-400 bg-green-500/10 border-green-500/20',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  HIGH: 'text-red-400 bg-red-500/10 border-red-500/20'
};

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;
  const today = new Date();
  const monday = getMonday(today);
  const sunday = addDays(monday, 6);

  const [
    plannedWorkouts, 
    activeContext,
    legacyPlan, 
    events, 
    userProfile
  ] = await Promise.all([
    prisma.plannedWorkout.findMany({
      where: { userId, date: { gte: monday, lte: sunday } },
      orderBy: { date: 'asc' }
    }),
    prisma.activeCoachContext.findUnique({
      where: { userId }
    }),
    prisma.trainingPlan.findFirst({
      where: { userId, weekStart: { lte: today }, status: { in: ['ACTIVE', 'DRAFT'] } },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.event.findMany({
      where: { userId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 5,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { weeklyHoursMax: true, thresholdPace: true, maxHR: true, ftp: true },
    }),
  ]);

  const weekDays = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
  
  // Build week grid
  const weekGrid = weekDays.map((dayName, i) => {
    const date = addDays(monday, i);
    const isoDate = toISODate(date);
    
    // Check new system first
    const newWorkouts = plannedWorkouts.filter(w => toISODate(new Date(w.date)) === isoDate);
    
    // Check legacy system fallback
    const legacyDays = (legacyPlan?.plan as any)?.days ?? [];
    const legacyDay = legacyDays.find((d: any) => d.date === isoDate);

    return { 
      dayName, 
      date, 
      isoDate, 
      workouts: newWorkouts.length > 0 ? newWorkouts : (legacyDay?.workouts ?? []),
      isRestDay: newWorkouts.length > 0 ? newWorkouts.every(w => w.isRestDay) : (legacyDay?.isRestDay ?? true),
      context: newWorkouts[0]?.dayContext || legacyDay?.notes
    };
  });

  const mainEvent = events.find(e => e.priority === 'MAIN');
  const periodization = computePeriodization(mainEvent?.date ?? null, userProfile?.weeklyHoursMax ?? 10);

  const todayStr = toISODate(today);
  const totalWorkouts = weekGrid.reduce((acc, d) => acc + d.workouts.length, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Tréninkový plán</h1>
          </div>
          <p className="text-zinc-400">Týden od {monday.toLocaleDateString('cs-CZ')} do {sunday.toLocaleDateString('cs-CZ')}</p>
        </div>

        {activeContext && (
          <div className="flex gap-3">
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${RISK_COLORS[activeContext.overtrainingRisk as keyof typeof RISK_COLORS]}`}>
              <Activity className="h-4 w-4" />
              <span className="text-sm font-semibold">Riziko: {activeContext.overtrainingRisk}</span>
            </div>
            <div className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold">Regenerace: {activeContext.recoveryStatus}</span>
            </div>
          </div>
        )}
      </div>

      {/* AI Coach Summary Section */}
      {activeContext && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                <h2 className="font-bold text-zinc-100 uppercase tracking-wider text-sm">AI Coach Schrnuti</h2>
              </div>
              <span className="text-[10px] text-zinc-500 italic">Aktualizováno {activeContext.sourceReviewDate.toLocaleDateString('cs-CZ')}</span>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-2 uppercase tracking-wide">
                  <TrendingUp className="h-4 w-4 text-green-400" /> Silné stránky
                </h3>
                <ul className="space-y-3">
                  {activeContext.focusAreas?.map((area: string, idx: number) => (
                    <li key={idx} className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500/60 mt-2 shrink-0" />
                      {area}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 flex items-center gap-2 uppercase tracking-wide">
                  <AlertTriangle className="h-4 w-4 text-red-400" /> Varování & Rizika
                </h3>
                <div className="space-y-3">
                  {activeContext.injuryWarnings.map((warning, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-200/80 leading-relaxed">
                      {warning}
                    </div>
                  ))}
                  {activeContext.injuryWarnings.length === 0 && <p className="text-xs text-zinc-500 italic">Žádná aktivní varování.</p>}
                </div>
              </div>

              <div className="md:col-span-2 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Hlavní instrukce</h3>
                <p className="text-sm text-zinc-300 italic leading-relaxed">
                  "{activeContext.coachDirectives}"
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
             <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <Zap className="h-4 w-4 text-yellow-400" /> Aktuální Status
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Trend HRV</span>
                    <span className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                      {activeContext.hrvTrend === 'DECLINING' ? <TrendingDown className="h-3 w-3 text-red-400" /> : <TrendingUp className="h-3 w-3 text-green-400" />}
                      {activeContext.hrvTrend}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Plán do</span>
                    <span className="text-xs font-medium text-zinc-300">{activeContext.validUntil.toLocaleDateString('cs-CZ')}</span>
                  </div>
                </div>
             </div>

             <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wide">Metriky</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">Max HR</p>
                    <p className="text-lg font-bold text-zinc-100">{userProfile?.maxHR || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">Prahové Tempo</p>
                    <p className="text-lg font-bold text-zinc-100">{userProfile?.thresholdPace ? `${Math.floor(userProfile.thresholdPace / 60)}:${String(userProfile.thresholdPace % 60).padStart(2, '0')}` : '—'}</p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Week Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            Týdenní rozvrh 
            <span className="text-xs font-normal text-zinc-500 px-2 py-0.5 bg-zinc-800 rounded-full">{totalWorkouts} tréninky</span>
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {weekGrid.map(({ dayName, date, isoDate, workouts, isRestDay, context }) => {
            const isToday = isoDate === todayStr;
            const isPast = date < today && !isToday;
            
            return (
              <div
                key={isoDate}
                className={`flex flex-col min-h-[160px] bg-zinc-900/40 rounded-2xl border transition-all duration-300 ${isToday ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20' : 'border-zinc-800 hover:border-zinc-700'} ${isPast ? 'opacity-50 grayscale-[20%]' : ''}`}
              >
                <div className="p-3 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-950/20">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-blue-400' : 'text-zinc-500'}`}>{dayName}</span>
                  <span className="text-[10px] text-zinc-600 font-medium">{date.getDate()}.{date.getMonth() + 1}.</span>
                </div>

                <div className="p-3 flex-1 flex flex-col gap-2">
                  {isRestDay && workouts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 opacity-40">
                      <span className="text-xl mb-1">🛌</span>
                      <span className="text-[10px] lowercase text-zinc-500">Rest day</span>
                    </div>
                  ) : (
                    workouts.map((w: any, idx: number) => (
                      <div 
                        key={w.id || idx} 
                        className={`group relative rounded-xl p-3 border transition-all ${INTENSITY_COLORS[w.subType?.toLowerCase()] || 'bg-zinc-800/40 border-zinc-700/50 text-zinc-300'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{SPORT_ICONS[w.workoutType] || '⚡'}</span>
                          {w.status === 'COMPLETED' ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <Circle className="h-3.5 w-3.5 opacity-30" />}
                        </div>
                        <p className="text-xs font-bold leading-tight line-clamp-2 mb-1 group-hover:text-zinc-50">{w.title}</p>
                        <div className="flex items-center gap-2 mt-auto">
                          <span className="text-[10px] font-medium opacity-80">{w.durationMinutes || Math.floor(w.duration / 60)} min</span>
                          {w.subType && <span className="text-[9px] uppercase tracking-tighter opacity-60">| {w.subType}</span>}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {context && (
                    <div className="mt-auto pt-2 border-t border-zinc-800/50">
                      <p className="text-[9px] text-zinc-500 italic line-clamp-2 hover:line-clamp-none transition-all cursor-default">
                        {context}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events / Milestones */}
      {events.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-zinc-100 mb-6 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Nadcházející závody
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(e => {
              const daysUntil = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000);
              return (
                <div key={e.id} className="group relative overflow-hidden flex items-center justify-between p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all">
                  <div className="relative z-10">
                    <p className="text-sm font-bold text-zinc-100 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{e.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{new Date(e.date).toLocaleDateString('cs-CZ')} · {e.sport}</p>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-2xl font-black text-blue-500 tracking-tighter">{daysUntil}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Dní</p>
                  </div>
                  {/* Subtle decorative element */}
                  <div className="absolute -bottom-2 -right-2 h-16 w-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback if no data */}
      {!plannedWorkouts.length && !legacyPlan && (
        <div className="text-center py-24 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
          <Brain className="h-16 w-16 mx-auto mb-4 text-zinc-700/50" />
          <h3 className="text-xl font-bold text-zinc-400">Žádný aktivní plán</h3>
          <p className="text-zinc-500 mt-2 max-w-sm mx-auto">
            Pro vygenerování nového plánu využij **Týdenní Review** v bočním menu.
          </p>
        </div>
      )}
    </div>
  );
}
