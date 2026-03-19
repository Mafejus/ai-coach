import { Suspense } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ai-coach/db';
import { getMonday, formatDuration } from '@ai-coach/shared';
import {
  Battery, Moon, Heart, Zap, Calendar, Trophy,
  TrendingUp, TrendingDown, Activity, Brain, CheckCircle, ExternalLink,
} from 'lucide-react';
import { BodyBatteryChart } from '@/components/charts/BodyBatteryChart';
import { HRVChart } from '@/components/charts/HRVChart';
import { DailyReportSection } from '@/components/dashboard/DailyReportSection';

async function getDashboardData(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const results = await Promise.allSettled([
    prisma.healthMetric.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.healthMetric.findMany({
      where: { userId, date: { gte: sevenDaysAgo, lt: tomorrow } },
      orderBy: { date: 'asc' },
      select: {
        date: true, bodyBattery: true, bodyBatteryChange: true,
        hrvStatus: true, hrvBaseline: true, sleepScore: true,
        sleepDuration: true, trainingReadiness: true, vo2max: true,
      },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: today }, endTime: { lte: tomorrow } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.trainingPlan.findFirst({
      where: { userId, weekStart: { lte: today }, status: { in: ['ACTIVE', 'DRAFT'] } },
      orderBy: { weekStart: 'desc' },
    }),
    prisma.event.findMany({
      where: { userId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 3,
    }),
    prisma.dailyReport.findFirst({ where: { userId, date: { gte: today } } }),
    prisma.healthMetric.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.plannedWorkout.findMany({
      where: { userId, date: { gte: today, lt: tomorrow } },
      orderBy: { date: 'asc' },
    }),
  ]);

  const [latestMetrics, weekMetrics, todayCalendar, currentPlan, upcomingEvents, todayReport, totalLastSync, plannedWorkouts] = results;

  return {
    metrics: latestMetrics.status === 'fulfilled' ? latestMetrics.value : null,
    weekMetrics: weekMetrics.status === 'fulfilled' ? weekMetrics.value : [],
    calendar: todayCalendar.status === 'fulfilled' ? todayCalendar.value : [],
    plan: currentPlan.status === 'fulfilled' ? currentPlan.value : null,
    events: upcomingEvents.status === 'fulfilled' ? upcomingEvents.value : [],
    report: todayReport.status === 'fulfilled' ? todayReport.value : null,
    lastSync: (totalLastSync.status === 'fulfilled' ? totalLastSync.value?.createdAt : null) ?? null,
    plannedWorkouts: plannedWorkouts.status === 'fulfilled' ? plannedWorkouts.value : [],
  };
}

function getBBColor(val: number | null) {
  if (!val) return 'text-zinc-400';
  if (val >= 60) return 'text-green-400';
  if (val >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

function getTRConfig(val: number | null): { label: string; color: string; bar: string } {
  if (!val) return { label: '—', color: 'text-zinc-400', bar: 'bg-zinc-700' };
  if (val >= 60) return { label: 'Ready', color: 'text-green-400', bar: 'bg-green-500' };
  if (val >= 30) return { label: 'Moderate', color: 'text-yellow-400', bar: 'bg-yellow-500' };
  return { label: 'Rest', color: 'text-red-400', bar: 'bg-red-500' };
}

function formatSleepDuration(minutes: number | null) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}min`;
}

const CATEGORY_COLORS: Record<string, string> = {
  school:   'bg-blue-500/15   border-blue-500/30   text-blue-300',
  work:     'bg-orange-500/15 border-orange-500/30 text-orange-300',
  sport:    'bg-green-500/15  border-green-500/30  text-green-300',
  personal: 'bg-zinc-800/60   border-zinc-700      text-zinc-300',
};

const SPORT_ICONS: Record<string, string> = { RUN: '🏃', BIKE: '🚴', SWIM: '🏊', STRENGTH: '🏋️', TRIATHLON: '🏅', OTHER: '⚡' };
const INTENSITY_COLORS: Record<string, string> = {
  easy:     'bg-green-500/15  text-green-400  border-green-500/25',
  moderate: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  hard:     'bg-red-500/15    text-red-400    border-red-500/25',
  max:      'bg-purple-500/15 text-purple-400 border-purple-500/25',
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const data = await getDashboardData(session.user.id);
  const m = data.metrics;
  const wm = data.weekMetrics as Array<{
    date: Date | string; bodyBattery: number | null; hrvStatus: number | null;
    hrvBaseline: number | null; sleepScore: number | null; sleepDuration: number | null; trainingReadiness: number | null;
  }>;

  const todayStr = new Date().toISOString().split('T')[0];
  const planData = data.plan?.plan as { days?: Array<{ date: string; workouts: Array<{ title: string; sport: string; duration: number; intensity: string; completed: boolean }>; isRestDay: boolean }> } | null;
  const todayLegacyPlan = planData?.days?.find(d => d.date === todayStr);

  const trCfg = getTRConfig(m?.trainingReadiness ?? null);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {data.lastSync && (
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Poslední sync</p>
            <p className="text-xs text-zinc-500">
              {new Date(data.lastSync).toLocaleString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* VO2 Max */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">VO2 Max</span>
            <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-zinc-100">{m?.vo2max ?? '—'}</p>
        </div>

        {/* Training Readiness */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Readiness</span>
            <Zap className={`h-3.5 w-3.5 ${trCfg.color}`} />
          </div>
          <div>
            <span className="text-2xl font-bold text-zinc-100">{m?.trainingReadiness ?? '—'}</span>
            <span className={`text-xs ml-2 font-medium ${trCfg.color}`}>{trCfg.label}</span>
          </div>
          {m?.trainingReadiness && (
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-1 rounded-full transition-all ${trCfg.bar}`} style={{ width: `${m.trainingReadiness}%` }} />
            </div>
          )}
        </div>

        {/* Body Battery */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Body Battery</span>
            <Battery className={`h-3.5 w-3.5 ${getBBColor(m?.bodyBattery ?? null)}`} />
          </div>
          <div>
            <span className={`text-2xl font-bold ${getBBColor(m?.bodyBattery ?? null)}`}>{m?.bodyBattery ?? '—'}</span>
            <span className="text-xs text-zinc-500 ml-1">/ 100</span>
          </div>
          {m?.bodyBatteryChange != null && (
            <div className="flex items-center gap-1 text-[11px]">
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span className="text-green-400">+{m.bodyBatteryChange} recovery</span>
            </div>
          )}
          <BodyBatteryChart data={wm.map(d => ({ date: String(d.date), bodyBattery: d.bodyBattery }))} />
        </div>

        {/* Sleep */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Spánek</span>
            <Moon className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div>
            <span className="text-2xl font-bold text-zinc-100">{formatSleepDuration(m?.sleepDuration ?? null)}</span>
          </div>
          {m?.sleepScore && (
            <div className="text-[11px] text-zinc-500">Skóre: <span className="text-blue-400 font-medium">{m.sleepScore}/100</span></div>
          )}
          <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
            {(m as any)?.deepSleep  && <div className="bg-blue-700  rounded-full" style={{ width: `${Math.min(100, ((m as any).deepSleep  / (m?.sleepDuration ?? 1)) * 100)}%` }} />}
            {(m as any)?.remSleep   && <div className="bg-purple-500 rounded-full" style={{ width: `${Math.min(100, ((m as any).remSleep   / (m?.sleepDuration ?? 1)) * 100)}%` }} />}
            {(m as any)?.lightSleep && <div className="bg-blue-400  rounded-full" style={{ width: `${Math.min(100, ((m as any).lightSleep / (m?.sleepDuration ?? 1)) * 100)}%` }} />}
          </div>
        </div>

        {/* HRV */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">HRV</span>
            <Heart className="h-3.5 w-3.5 text-pink-400" />
          </div>
          <div>
            <span className="text-2xl font-bold text-zinc-100">{m?.hrvStatus ? Math.round(m.hrvStatus) : '—'}</span>
            <span className="text-xs text-zinc-500 ml-1">ms</span>
          </div>
          {m?.hrvBaseline && m?.hrvStatus && (
            <div className="flex items-center gap-1 text-xs">
              {m.hrvStatus >= m.hrvBaseline
                ? <TrendingUp className="h-3 w-3 text-green-400" />
                : <TrendingDown className="h-3 w-3 text-red-400" />}
              <span className={m.hrvStatus >= m.hrvBaseline ? 'text-green-400' : 'text-red-400'}>
                {Math.round(((m.hrvStatus - m.hrvBaseline) / m.hrvBaseline) * 100)}%
              </span>
              <span className="text-zinc-600 text-[10px]">vs baseline</span>
            </div>
          )}
        </div>
      </div>

      {/* Today's plan + Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's workouts */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <h2 className="font-bold text-zinc-100 text-sm uppercase tracking-wider">Dnešní plán</h2>
            </div>
            <Link href="/training" className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
              Celý týden <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-5">
            {data.plannedWorkouts.length > 0 ? (
              data.plannedWorkouts.every(w => w.isRestDay) ? (
                <div className="text-center py-8 text-zinc-500">
                  <span className="text-3xl block mb-2">🛌</span>
                  <p className="text-sm font-medium text-zinc-400">Odpočinkový den</p>
                  <p className="text-xs text-zinc-600 mt-1">Regenerace je součást tréninku.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.plannedWorkouts.filter(w => !w.isRestDay).map((w, i) => (
                    <div key={w.id ?? i} className={`rounded-xl border overflow-hidden ${INTENSITY_COLORS[w.subType?.toLowerCase() ?? ''] ?? 'bg-zinc-800/40 border-zinc-700/50 text-zinc-300'}`}>
                      {/* Header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                        <span className="text-2xl shrink-0">{SPORT_ICONS[w.workoutType ?? 'OTHER'] ?? '⚡'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-100 leading-tight">{w.title ?? 'Trénink'}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs opacity-70">{w.durationMinutes} min</span>
                            {w.subType && <span className="text-xs opacity-60 uppercase tracking-wide">· {w.subType}</span>}
                            {w.workoutType && <span className="text-xs opacity-50">· {w.workoutType}</span>}
                          </div>
                        </div>
                        {w.status === 'COMPLETED' && <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />}
                      </div>
                      {/* Body */}
                      <div className="px-4 py-3 space-y-3">
                        {w.description && (
                          <p className="text-xs text-zinc-300 leading-relaxed">{w.description}</p>
                        )}
                        {(w.warmup || w.mainSet || w.cooldown) && (
                          <div className="space-y-1.5 text-xs">
                            {w.warmup && (
                              <div className="flex gap-2">
                                <span className="text-zinc-600 w-20 shrink-0">Rozcvička</span>
                                <span className="text-zinc-400 leading-relaxed">{w.warmup}</span>
                              </div>
                            )}
                            {w.mainSet && (
                              <div className="flex gap-2">
                                <span className="text-zinc-600 w-20 shrink-0">Hlavní část</span>
                                <span className="text-zinc-200 font-medium leading-relaxed">{w.mainSet}</span>
                              </div>
                            )}
                            {w.cooldown && (
                              <div className="flex gap-2">
                                <span className="text-zinc-600 w-20 shrink-0">Zklidnění</span>
                                <span className="text-zinc-400 leading-relaxed">{w.cooldown}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {(w.targetPace || w.targetHR || w.targetPower || w.targetZones) && (
                          <div className="flex flex-wrap gap-1.5">
                            {w.targetZones && <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400">Zóny: {w.targetZones}</span>}
                            {w.targetPace && <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400">Tempo: {w.targetPace}</span>}
                            {w.targetHR && <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400">TF: {w.targetHR}</span>}
                            {w.targetPower && <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400">Výkon: {w.targetPower}</span>}
                          </div>
                        )}
                        {w.coachNotes && (
                          <div className="p-2.5 rounded-lg bg-black/20 border border-white/5">
                            <p className="text-[11px] text-zinc-400 italic leading-relaxed">💬 {w.coachNotes}</p>
                          </div>
                        )}
                        {w.dayContext && (
                          <p className="text-[11px] text-zinc-600 italic">{w.dayContext}</p>
                        )}
                        {w.nutritionFocus && (
                          <p className="text-[11px] text-zinc-500">🥗 {w.nutritionFocus}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : todayLegacyPlan?.isRestDay ? (
              <div className="text-center py-8 text-zinc-500">
                <span className="text-3xl block mb-2">🛌</span>
                <p className="text-sm">Odpočinkový den</p>
              </div>
            ) : todayLegacyPlan?.workouts && todayLegacyPlan.workouts.length > 0 ? (
              <div className="space-y-2">
                {todayLegacyPlan.workouts.map((w, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${INTENSITY_COLORS[w.intensity] ?? 'bg-zinc-800/40 border-zinc-700/50 text-zinc-300'}`}>
                    <span className="text-2xl shrink-0">{SPORT_ICONS[w.sport] ?? '⚡'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{w.title}</p>
                      <p className="text-xs opacity-70">{Math.floor(w.duration / 60)}h {w.duration % 60}min · {w.intensity}</p>
                    </div>
                    {w.completed && <span className="text-green-400 text-lg">✓</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-600 text-sm">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Žádný plán na dnes.</p>
                <p className="text-xs mt-1 text-zinc-700">Propoj Garmin/Strava a nech AI vygenerovat plán.</p>
              </div>
            )}
          </div>
        </div>

        {/* Events */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <h2 className="font-bold text-zinc-100 text-sm uppercase tracking-wider">Závody</h2>
          </div>
          <div className="p-5">
            {data.events.length > 0 ? (
              <div className="space-y-3">
                {data.events.map(e => {
                  const daysUntil = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={e.id} className="group flex items-center justify-between p-3 bg-zinc-950/40 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 truncate">{e.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{e.sport}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xl font-black text-blue-500">{daysUntil}</p>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">dní</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-600 text-sm">
                <Trophy className="h-7 w-7 mx-auto mb-2 opacity-20" />
                <p>Žádné závody</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      {data.calendar.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <h2 className="font-bold text-zinc-100 text-sm uppercase tracking-wider">Dnešní kalendář</h2>
          </div>
          <div className="p-5 space-y-2">
            {data.calendar.map(ev => (
              <div
                key={ev.id}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${CATEGORY_COLORS[ev.category ?? 'personal'] ?? CATEGORY_COLORS.personal}`}
              >
                <span className="text-xs font-mono opacity-70 shrink-0">
                  {new Date(ev.startTime).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(ev.endTime).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-medium truncate">{ev.title}</span>
                {ev.location && <span className="text-xs opacity-50 ml-auto shrink-0 hidden sm:block">{ev.location}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Morning briefing */}
      <DailyReportSection initialReport={data.report ? (data.report.markdown as string) : null} />
    </div>
  );
}
