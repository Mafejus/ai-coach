import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ai-coach/db';
import { getMonday, formatPace, formatDuration } from '@ai-coach/shared';
import { Battery, Moon, Heart, Zap, Calendar, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
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

  const [todayMetrics, weekMetrics, todayCalendar, currentPlan, upcomingEvents, todayReport] =
    await Promise.allSettled([
      prisma.healthMetric.findFirst({ where: { userId, date: { gte: today, lt: tomorrow } } }),
      prisma.healthMetric.findMany({
        where: { userId, date: { gte: sevenDaysAgo, lt: tomorrow } },
        orderBy: { date: 'asc' },
        select: { date: true, bodyBattery: true, hrvStatus: true, hrvBaseline: true, sleepScore: true, sleepDuration: true, trainingReadiness: true },
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
    ]);

  return {
    metrics: todayMetrics.status === 'fulfilled' ? todayMetrics.value : null,
    weekMetrics: weekMetrics.status === 'fulfilled' ? weekMetrics.value : [],
    calendar: todayCalendar.status === 'fulfilled' ? todayCalendar.value : [],
    plan: currentPlan.status === 'fulfilled' ? currentPlan.value : null,
    events: upcomingEvents.status === 'fulfilled' ? upcomingEvents.value : [],
    report: todayReport.status === 'fulfilled' ? todayReport.value : null,
  };
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 uppercase tracking-wider">{title}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div>
        <span className="text-2xl font-bold text-zinc-100">{value}</span>
        {subtitle && <span className="text-xs text-zinc-400 ml-2">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function getBBColor(val: number | null) {
  if (!val) return 'text-zinc-400';
  if (val >= 60) return 'text-green-400';
  if (val >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

function getTRLabel(val: number | null) {
  if (!val) return '—';
  if (val >= 60) return 'Ready';
  if (val >= 30) return 'Moderate';
  return 'Rest';
}

function formatSleepDuration(minutes: number | null) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}min`;
}

const CATEGORY_COLORS: Record<string, string> = {
  school: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  work: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  sport: 'bg-green-500/20 border-green-500/40 text-green-300',
  personal: 'bg-zinc-700/50 border-zinc-600 text-zinc-300',
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const data = await getDashboardData(session.user.id);
  const m = data.metrics;
  const wm = data.weekMetrics as Array<{ date: Date | string; bodyBattery: number | null; hrvStatus: number | null; hrvBaseline: number | null; sleepScore: number | null; sleepDuration: number | null; trainingReadiness: number | null }>;

  // Get today's workouts from plan
  const todayStr = new Date().toISOString().split('T')[0];
  const planData = data.plan?.plan as { days?: Array<{ date: string; workouts: Array<{ title: string; sport: string; duration: number; intensity: string; completed: boolean }>; isRestDay: boolean }> } | null;
  const todayPlan = planData?.days?.find(d => d.date === todayStr);

  const SPORT_ICONS: Record<string, string> = { RUN: '🏃', BIKE: '🚴', SWIM: '🏊', STRENGTH: '🏋️', TRIATHLON: '🏅', OTHER: '⚡' };
  const INTENSITY_COLORS: Record<string, string> = {
    easy: 'bg-green-500/20 text-green-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    hard: 'bg-red-500/20 text-red-400',
    max: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-400">
          {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Body Battery */}
        <MetricCard
          title="Body Battery"
          value={m?.bodyBattery ?? '—'}
          subtitle="/ 100"
          icon={Battery}
          color={getBBColor(m?.bodyBattery ?? null)}
        >
          <BodyBatteryChart data={wm.map(d => ({ date: String(d.date), bodyBattery: d.bodyBattery }))} />
        </MetricCard>

        {/* Sleep */}
        <MetricCard
          title="Spánek"
          value={formatSleepDuration(m?.sleepDuration ?? null)}
          subtitle={m?.sleepScore ? `${m.sleepScore}/100` : undefined}
          icon={Moon}
          color="text-blue-400"
        >
          <div className="flex gap-1 mt-1">
            {m?.deepSleep && <div className="h-1.5 rounded-full bg-blue-700" style={{ width: `${Math.min(100, (m.deepSleep / (m.sleepDuration ?? 1)) * 100)}%` }} />}
            {m?.remSleep && <div className="h-1.5 rounded-full bg-purple-500" style={{ width: `${Math.min(100, (m.remSleep / (m.sleepDuration ?? 1)) * 100)}%` }} />}
            {m?.lightSleep && <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${Math.min(100, (m.lightSleep / (m.sleepDuration ?? 1)) * 100)}%` }} />}
          </div>
        </MetricCard>

        {/* HRV */}
        <MetricCard
          title="HRV"
          value={m?.hrvStatus ? `${Math.round(m.hrvStatus)}` : '—'}
          subtitle="ms"
          icon={Heart}
          color="text-pink-400"
        >
          {m?.hrvBaseline && m?.hrvStatus && (
            <div className="flex items-center gap-1 text-xs">
              {m.hrvStatus >= m.hrvBaseline
                ? <TrendingUp className="h-3 w-3 text-green-400" />
                : <TrendingDown className="h-3 w-3 text-red-400" />}
              <span className={m.hrvStatus >= m.hrvBaseline ? 'text-green-400' : 'text-red-400'}>
                {Math.round(((m.hrvStatus - m.hrvBaseline) / m.hrvBaseline) * 100)}%
              </span>
              <span className="text-zinc-500">vs baseline</span>
            </div>
          )}
        </MetricCard>

        {/* Training Readiness */}
        <MetricCard
          title="Training Readiness"
          value={m?.trainingReadiness ?? '—'}
          subtitle={getTRLabel(m?.trainingReadiness ?? null)}
          icon={Zap}
          color={getBBColor(m?.trainingReadiness ?? null)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's plan */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            Dnešní plán
          </h2>
          {todayPlan?.isRestDay ? (
            <div className="text-center py-8 text-zinc-400">
              <span className="text-2xl">😴</span>
              <p className="mt-2">Odpočinkový den</p>
            </div>
          ) : todayPlan?.workouts && todayPlan.workouts.length > 0 ? (
            <div className="space-y-3">
              {todayPlan.workouts.map((w, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                  <span className="text-2xl">{SPORT_ICONS[w.sport] ?? '⚡'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-100">{w.title}</p>
                    <p className="text-xs text-zinc-400">{Math.floor(w.duration / 60)}h {w.duration % 60}min</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${INTENSITY_COLORS[w.intensity] ?? 'bg-zinc-700 text-zinc-300'}`}>
                    {w.intensity}
                  </span>
                  {w.completed && <span className="text-green-400 text-sm">✅</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500 text-sm">
              Žádný plán na dnes. Propoj Garmin/Strava a nech AI vygenerovat plán.
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            Závody
          </h2>
          {data.events.length > 0 ? (
            <div className="space-y-3">
              {data.events.map(e => {
                const daysUntil = Math.ceil((new Date(e.date).getTime() - Date.now()) / 86400000);
                return (
                  <div key={e.id} className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-sm font-medium text-zinc-100">{e.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{e.sport}</p>
                    <p className="text-lg font-bold text-blue-400 mt-1">{daysUntil}d</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">Žádné nadcházející závody</p>
          )}
        </div>
      </div>

      {/* Today's calendar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="font-semibold text-zinc-100 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          Dnešní kalendář
        </h2>
        {data.calendar.length > 0 ? (
          <div className="space-y-2">
            {data.calendar.map(ev => (
              <div
                key={ev.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${CATEGORY_COLORS[ev.category ?? 'personal'] ?? CATEGORY_COLORS.personal}`}
              >
                <span className="text-xs font-mono">
                  {new Date(ev.startTime).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(ev.endTime).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-medium">{ev.title}</span>
                {ev.location && <span className="text-xs opacity-70 ml-auto">{ev.location}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Žádné události dnes</p>
        )}
      </div>

      {/* Daily report */}
      <DailyReportSection initialReport={data.report ? (data.report.markdown as string) : null} />
    </div>
  );
}
