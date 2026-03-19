'use client';

import { useState, useEffect } from 'react';
import { Heart, Moon, Zap, Battery, Activity, Wind } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { SleepChart } from '@/components/charts/SleepChart';
import { HRVChart } from '@/components/charts/HRVChart';
import { BodyBatteryChart } from '@/components/charts/BodyBatteryChart';
import { RestingHRChart } from '@/components/charts/RestingHRChart';
import { TrainingReadinessChart } from '@/components/charts/TrainingReadinessChart';
import { StressChart } from '@/components/charts/StressChart';

type Period = 7 | 14 | 30 | 90;

interface HealthMetric {
  id: string;
  date: string;
  sleepScore: number | null;
  sleepDuration: number | null;
  deepSleep: number | null;
  remSleep: number | null;
  lightSleep: number | null;
  awakeDuration: number | null;
  restingHR: number | null;
  hrvStatus: number | null;
  hrvBaseline: number | null;
  bodyBattery: number | null;
  bodyBatteryChange: number | null;
  stressScore: number | null;
  trainingReadiness: number | null;
  vo2max: number | null;
}

interface DailyData {
  heartRateValues: [number, number | null][];
  stressValues: [number, number][];
  bodyBatteryValues: [number, number][];
  restingHR: number | null;
  maxHR: number | null;
  sleepScore: number | null;
  sleepDuration: number | null;
  deepSleep: number | null;
  remSleep: number | null;
  lightSleep: number | null;
  awakeDuration: number | null;
  sleepStart: string | null;
  sleepEnd: string | null;
  bodyBattery: number | null;
  bodyBatteryChange: number | null;
  stressScore: number | null;
  hrvStatus: number | null;
  trainingReadiness: number | null;
  vo2max: number | null;
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined);
  return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

function fmtMinutes(mins: number | null): string {
  if (!mins) return '—';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function StatCard({ label, value, unit, icon: Icon, color }: { label: string; value: number | string | null; unit?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-zinc-100">
        {value ?? '—'}{value !== null && value !== undefined && unit && <span className="text-sm font-normal text-zinc-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

function SleepBar({ label, minutes, color, total }: { label: string; minutes: number | null; color: string; total: number }) {
  if (!minutes) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className="text-zinc-400 w-16">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${(minutes / total) * 100}%` }}
        />
      </div>
      <span className="text-zinc-200 font-medium w-14 text-right">{fmtMinutes(minutes)}</span>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#71717a', fontSize: 11 },
};

export default function HealthPage() {
  const [period, setPeriod] = useState<Period>(14);
  const [data, setData] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDaily, setShowDaily] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - period);
    fetch(`/api/health/metrics?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`)
      .then(r => r.json() as Promise<HealthMetric[]>)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    if (!showDaily) return;
    setDailyLoading(true);
    fetch(`/api/health/daily?date=${selectedDate}`)
      .then(r => r.json() as Promise<DailyData>)
      .then(d => { setDaily(d); setDailyLoading(false); })
      .catch(() => setDailyLoading(false));
  }, [showDaily, selectedDate]);

  // Parse HR time-series
  const dailyHR = (() => {
    if (!daily?.heartRateValues?.length) return [];
    const map = new Map<number, number[]>();
    for (const [ts, bpm] of daily.heartRateValues) {
      if (bpm == null) continue;
      const minuteKey = Math.floor(ts / 60000);
      if (!map.has(minuteKey)) map.set(minuteKey, []);
      map.get(minuteKey)!.push(bpm);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([minuteKey, values]) => ({
      hour: parseFloat(((minuteKey % 1440) / 60).toFixed(2)),
      bpm: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    }));
  })();

  const dailyStress = (() => {
    if (!daily?.stressValues?.length) return [];
    return daily.stressValues
      .filter(([, s]) => s >= 0)
      .map(([ts, stress]) => ({
        hour: parseFloat(((Math.floor(ts / 60000) % 1440) / 60).toFixed(2)),
        stress,
      }));
  })();

  const dailyBB = (() => {
    if (!daily?.bodyBatteryValues?.length) return [];
    return daily.bodyBatteryValues
      .filter(([, v]) => v >= 0)
      .map(([ts, value]) => ({
        hour: parseFloat(((Math.floor(ts / 60000) % 1440) / 60).toFixed(2)),
        value,
      }));
  })();

  const PERIODS: Period[] = [7, 14, 30, 90];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-500/10 rounded-xl border border-pink-500/20">
            <Heart className="h-5 w-5 text-pink-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Zdraví</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowDaily(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${showDaily ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
          >
            Denní přehled
          </button>
          <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${period === p ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Daily panel */}
      {showDaily && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Daily header */}
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Denní přehled
            </h3>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-zinc-200 text-xs"
            />
          </div>

          <div className="p-5 space-y-5">
            {dailyLoading ? (
              <div className="h-32 animate-pulse bg-zinc-800/60 rounded-2xl" />
            ) : !daily ? null : (
              <>
                {/* Daily stat grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <StatCard label="Klidový tep" value={daily.restingHR} unit="bpm" icon={Heart} color="text-red-400" />
                  <StatCard label="Spánek" value={daily.sleepScore} unit="/ 100" icon={Moon} color="text-blue-400" />
                  <StatCard label="Body Battery" value={daily.bodyBattery} icon={Battery} color="text-green-400" />
                  <StatCard label="HRV" value={daily.hrvStatus} unit="ms" icon={Activity} color="text-pink-400" />
                  <StatCard label="Průměrný stres" value={daily.stressScore} icon={Wind} color="text-orange-400" />
                  <StatCard label="Max tep" value={daily.maxHR} unit="bpm" icon={Heart} color="text-red-500" />
                  {daily.bodyBatteryChange && <StatCard label="Body Recovery" value={`+${daily.bodyBatteryChange}`} icon={Battery} color="text-green-500" />}
                  {daily.trainingReadiness && <StatCard label="Train. Readiness" value={daily.trainingReadiness} unit="/ 100" icon={Zap} color="text-yellow-400" />}
                  {daily.vo2max && <StatCard label="VO2 Max" value={daily.vo2max} icon={Zap} color="text-purple-400" />}
                </div>

                {/* Sleep breakdown */}
                {(daily.sleepDuration ?? 0) > 0 && (
                  <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                        <Moon className="h-3.5 w-3.5 text-blue-400" />
                        Rozložení spánku — {fmtMinutes(daily.sleepDuration)}
                      </p>
                      {daily.sleepStart && daily.sleepEnd && (
                        <p className="text-[10px] text-zinc-500">
                          {new Date(daily.sleepStart).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(daily.sleepEnd).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    {/* Visual bar */}
                    {daily.sleepDuration && (
                      <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-3">
                        {daily.deepSleep && <div style={{ width: `${(daily.deepSleep / daily.sleepDuration) * 100}%` }} className="bg-blue-500" />}
                        {daily.remSleep && <div style={{ width: `${(daily.remSleep / daily.sleepDuration) * 100}%` }} className="bg-purple-500" />}
                        {daily.lightSleep && <div style={{ width: `${(daily.lightSleep / daily.sleepDuration) * 100}%` }} className="bg-blue-300" />}
                        {daily.awakeDuration && <div style={{ width: `${(daily.awakeDuration / daily.sleepDuration) * 100}%` }} className="bg-zinc-600" />}
                      </div>
                    )}
                    <div className="space-y-2">
                      <SleepBar label="Hluboký" minutes={daily.deepSleep} color="bg-blue-500" total={daily.sleepDuration ?? 1} />
                      <SleepBar label="REM" minutes={daily.remSleep} color="bg-purple-500" total={daily.sleepDuration ?? 1} />
                      <SleepBar label="Lehký" minutes={daily.lightSleep} color="bg-blue-300" total={daily.sleepDuration ?? 1} />
                      <SleepBar label="Probuzení" minutes={daily.awakeDuration} color="bg-zinc-500" total={daily.sleepDuration ?? 1} />
                    </div>
                  </div>
                )}

                {/* Body Battery chart */}
                {dailyBB.length > 0 && (
                  <ChartCard title="Body Battery" icon={<Battery className="h-4 w-4 text-green-400" />}>
                    <ResponsiveContainer width="100%" height={140}>
                      <AreaChart data={dailyBB}>
                        <defs>
                          <linearGradient id="bbGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="hour" tickFormatter={(h: number) => `${Math.floor(h)}:00`} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <Tooltip {...tooltipStyle} formatter={(v) => [`${v as number}`, 'Body Battery']} />
                        <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={1.5} fill="url(#bbGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* HR chart */}
                {dailyHR.length > 0 && (
                  <ChartCard title="Srdeční tep" icon={<Heart className="h-4 w-4 text-red-400" />}>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={dailyHR}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="hour" tickFormatter={(h: number) => `${Math.floor(h)}:00`} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <Tooltip {...tooltipStyle} formatter={(v) => [`${v as number} bpm`, 'SR']} />
                        <Line type="monotone" dataKey="bpm" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Stress chart */}
                {dailyStress.length > 0 && (
                  <ChartCard title="Stres" icon={<Wind className="h-4 w-4 text-orange-400" />}>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={dailyStress}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="hour" tickFormatter={(h: number) => `${Math.floor(h)}:00`} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} />
                        <Tooltip {...tooltipStyle} formatter={(v) => [`${v as number}`, 'Stres']} />
                        <Line type="monotone" dataKey="stress" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {dailyHR.length === 0 && dailyBB.length === 0 && dailyStress.length === 0 && !daily.sleepScore && (
                  <p className="text-sm text-zinc-500 text-center py-4">Denní data nejsou k dispozici. Spusť Garmin sync.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Period stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={`Avg spánek (${period}d)`} value={avg(data.map(d => d.sleepDuration ? Math.round(d.sleepDuration / 60) : null))} unit="h" icon={Moon} color="text-blue-400" />
        <StatCard label="Avg HRV" value={avg(data.map(d => d.hrvStatus))} unit="ms" icon={Heart} color="text-pink-400" />
        <StatCard label="Avg BB" value={avg(data.map(d => d.bodyBattery))} icon={Battery} color="text-green-400" />
        <StatCard label="Avg HR" value={avg(data.map(d => d.restingHR))} unit="bpm" icon={Activity} color="text-red-400" />
        <StatCard label="Avg stres" value={avg(data.map(d => d.stressScore))} icon={Wind} color="text-orange-400" />
        <StatCard label="Readiness" value={avg(data.map(d => d.trainingReadiness))} icon={Zap} color="text-yellow-400" />
      </div>

      {/* Chart grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl text-center">
          <div className="p-4 bg-pink-500/10 rounded-2xl border border-pink-500/20 w-fit mx-auto mb-4">
            <Moon className="h-10 w-10 text-pink-400/50" />
          </div>
          <p className="font-semibold text-zinc-400">Žádná zdravotní data za dané období</p>
          <p className="text-sm text-zinc-600 mt-1">Propoj Garmin a spusť sync v nastavení.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Spánek" icon={<Moon className="h-4 w-4 text-blue-400" />}>
            <SleepChart data={data} />
          </ChartCard>
          <ChartCard title="HRV" icon={<Heart className="h-4 w-4 text-pink-400" />}>
            <HRVChart data={data} />
          </ChartCard>
          <ChartCard title="Body Battery" icon={<Battery className="h-4 w-4 text-green-400" />}>
            <BodyBatteryChart data={data} />
          </ChartCard>
          <ChartCard title="Klidová tepovka" icon={<Activity className="h-4 w-4 text-red-400" />}>
            <RestingHRChart data={data} />
          </ChartCard>
          <ChartCard title="Training Readiness" icon={<Zap className="h-4 w-4 text-yellow-400" />}>
            <TrainingReadinessChart data={data} />
          </ChartCard>
          <ChartCard title="Stres" icon={<Wind className="h-4 w-4 text-orange-400" />}>
            <StressChart data={data} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
