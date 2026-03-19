'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Zap, Timer, MapPin, Flame, TrendingUp, Activity, Mountain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';
import dynamic from 'next/dynamic';
import { formatDuration } from '@ai-coach/shared';

const ActivityMap = dynamic(() => import('@/components/activities/ActivityMap'), { ssr: false });

const SPORT_ICONS: Record<string, string> = { RUN: '🏃', BIKE: '🚴', SWIM: '🏊', STRENGTH: '🏋️', TRIATHLON: '🏅', OTHER: '⚡' };

const SPORT_COLORS: Record<string, { from: string; via: string; accent: string; text: string }> = {
  RUN:      { from: 'from-blue-500/15',   via: 'via-blue-500/5',   accent: 'bg-blue-500/15 border-blue-500/25',   text: 'text-blue-400' },
  BIKE:     { from: 'from-amber-500/15',  via: 'via-amber-500/5',  accent: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400' },
  SWIM:     { from: 'from-cyan-500/15',   via: 'via-cyan-500/5',   accent: 'bg-cyan-500/15 border-cyan-500/25',   text: 'text-cyan-400' },
  STRENGTH: { from: 'from-purple-500/15', via: 'via-purple-500/5', accent: 'bg-purple-500/15 border-purple-500/25', text: 'text-purple-400' },
  OTHER:    { from: 'from-zinc-800/60',   via: 'via-zinc-800/20',  accent: 'bg-zinc-800 border-zinc-700',         text: 'text-zinc-400' },
};

interface ActivityDetail {
  id: string;
  sport: string;
  name: string | null;
  date: string;
  duration: number;
  distance: number | null;
  avgHR: number | null;
  maxHR: number | null;
  avgPace: number | null;
  avgPower: number | null;
  normalizedPower: number | null;
  calories: number | null;
  elevationGain: number | null;
  avgCadence: number | null;
  trainingLoad: number | null;
  source: string;
  laps: GarminLap[] | null;
  rawData: GarminRawData | null;
}

interface GarminRawData {
  details?: ActivityDetails;
  avgStrideLength?: number;
  avgVerticalRatio?: number;
  avgVerticalOscillation?: number;
  avgGroundContactTime?: number;
  avgGroundContactBalance?: number;
  timeInHrZone_1?: number;
  timeInHrZone_2?: number;
  timeInHrZone_3?: number;
  timeInHrZone_4?: number;
  timeInHrZone_5?: number;
  aerobicTrainingEffect?: number;
  anaerobicTrainingEffect?: number;
  trainingStressScore?: number;
  trainingReadinessScore?: number;
  vo2MaxValue?: number;
  [key: string]: unknown;
}

interface ActivityDetails {
  geoPolylineDTO?: {
    polyline?: Array<{ lat: number; lon: number; altitude?: number; distanceInMeters?: number }>;
  };
  metricDescriptors?: Array<{ metricsIndex: number; key: string }>;
  activityDetailMetrics?: Array<{ startTimeGMT?: string; metrics: (number | null)[] }>;
}

interface GarminLap {
  lapIndex?: number;
  distanceInMeters?: number;
  elapsedDuration?: number;
  averageSpeed?: number;
  averageHR?: number;
  maximumHR?: number;
  totalAscent?: number;
  averageCadence?: number;
  strideLength?: number;
}

function formatPace(secPerKm: number | null | undefined, sport: string): string {
  if (!secPerKm) return '—';
  if (sport === 'SWIM') {
    const s = secPerKm / 10;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}/100m`;
  }
  return `${Math.floor(secPerKm / 60)}:${String(Math.floor(secPerKm % 60)).padStart(2, '0')}/km`;
}

function speedToPace(speedMs: number | undefined): number | null {
  if (!speedMs || speedMs <= 0) return null;
  return 1000 / speedMs;
}

function parseMetrics(details: ActivityDetails | undefined) {
  if (!details?.metricDescriptors || !details?.activityDetailMetrics) {
    return { hr: [], pace: [], elevation: [], cadence: [], strideLength: [] };
  }
  const desc = details.metricDescriptors;
  const idx = (keys: string[]) => {
    for (const k of keys) {
      const found = desc.find(d => d.key === k);
      if (found) return found.metricsIndex;
    }
    return -1;
  };
  const hrIdx = idx(['directHeartRate', 'heartRate']);
  const speedIdx = idx(['directSpeed', 'speed']);
  const altIdx = idx(['directAltitude', 'altitude']);
  const cadenceIdx = idx(['directRunCadence', 'directCadence', 'cadence']);
  const strideLenIdx = idx(['directStrideLength', 'strideLength']);

  const hr: { t: number; v: number }[] = [];
  const pace: { t: number; v: number }[] = [];
  const elevation: { t: number; v: number }[] = [];
  const cadence: { t: number; v: number }[] = [];
  const strideLength: { t: number; v: number }[] = [];

  details.activityDetailMetrics.forEach((m, i) => {
    const t = i;
    if (hrIdx >= 0 && m.metrics[hrIdx] != null) hr.push({ t, v: m.metrics[hrIdx] as number });
    if (speedIdx >= 0 && m.metrics[speedIdx] != null) {
      const p = speedToPace(m.metrics[speedIdx] as number);
      if (p && p < 1200) pace.push({ t, v: p });
    }
    if (altIdx >= 0 && m.metrics[altIdx] != null) elevation.push({ t, v: m.metrics[altIdx] as number });
    if (cadenceIdx >= 0 && m.metrics[cadenceIdx] != null) {
      const c = m.metrics[cadenceIdx] as number;
      if (c > 0) cadence.push({ t, v: c });
    }
    if (strideLenIdx >= 0 && m.metrics[strideLenIdx] != null) {
      const s = m.metrics[strideLenIdx] as number;
      if (s > 0) strideLength.push({ t, v: Math.round(s * 100) });
    }
  });

  const downsample = <T,>(arr: T[], max: number): T[] => {
    if (arr.length <= max) return arr;
    const step = Math.ceil(arr.length / max);
    return arr.filter((_, i) => i % step === 0);
  };

  return {
    hr: downsample(hr, 300),
    pace: downsample(pace, 300),
    elevation: downsample(elevation, 300),
    cadence: downsample(cadence, 200),
    strideLength: downsample(strideLength, 200),
  };
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent = 'text-zinc-100',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-400 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className={`text-base font-bold ${accent} leading-tight`}>{value}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const HR_ZONE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#ef4444'];
const HR_ZONE_LABELS = ['Z1 Lehká', 'Z2 Aerobní', 'Z3 Tempo', 'Z4 Práh', 'Z5 VO2Max'];

function HRZones({ raw }: { raw: GarminRawData }) {
  const zones = [
    raw.timeInHrZone_1 ?? 0,
    raw.timeInHrZone_2 ?? 0,
    raw.timeInHrZone_3 ?? 0,
    raw.timeInHrZone_4 ?? 0,
    raw.timeInHrZone_5 ?? 0,
  ];
  const total = zones.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <Heart className="h-4 w-4 text-red-400" />
        Čas v tepových zónách
      </h3>
      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-4">
        {zones.map((secs, i) => secs > 0 ? (
          <div
            key={i}
            style={{ width: `${(secs / total) * 100}%`, backgroundColor: HR_ZONE_COLORS[i] }}
            className="transition-all"
          />
        ) : null)}
      </div>
      <div className="space-y-2.5">
        {zones.map((secs, i) => secs > 0 ? (
          <div key={i} className="flex items-center gap-3 text-xs">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: HR_ZONE_COLORS[i] }} />
            <span className="w-20 text-zinc-400">{HR_ZONE_LABELS[i]}</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${(secs / total) * 100}%`, backgroundColor: HR_ZONE_COLORS[i] }}
              />
            </div>
            <span className="w-14 text-right font-medium text-zinc-200">{formatDuration(Math.round(secs))}</span>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-zinc-100 mb-4 flex items-center gap-2 uppercase tracking-wider">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activities/${id}`)
      .then(r => r.json() as Promise<ActivityDetail>)
      .then(d => { setActivity(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-32 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-20 text-zinc-400">
        <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>Aktivita nenalezena.</p>
      </div>
    );
  }

  const raw = activity.rawData ?? {};
  const details = (raw as GarminRawData).details;
  const polyline = details?.geoPolylineDTO?.polyline;
  const { hr, pace, elevation, cadence, strideLength } = parseMetrics(details);
  const laps = activity.laps ?? [];
  const colors = SPORT_COLORS[activity.sport] ?? SPORT_COLORS.OTHER!;

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 12 },
    labelStyle: { color: '#71717a', fontSize: 11 },
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Hero header */}
      <div className={`relative overflow-hidden bg-zinc-900/50 border border-zinc-800 rounded-2xl`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${colors.from} ${colors.via} to-transparent pointer-events-none`} />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-100 transition-colors shrink-0 mt-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={`shrink-0 w-14 h-14 rounded-2xl border flex items-center justify-center text-3xl ${colors.accent}`}>
                {SPORT_ICONS[activity.sport] ?? '⚡'}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-zinc-100 tracking-tight truncate">{activity.name ?? activity.sport}</h1>
                <p className="text-sm text-zinc-400 mt-0.5">
                  {new Date(activity.date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}
                  {new Date(activity.date).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors.accent} ${colors.text}`}>
                    {activity.sport}
                  </span>
                  <span className="text-[11px] text-zinc-600 uppercase tracking-wide">{activity.source}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      {polyline && polyline.length > 0 && (
        <div className="rounded-2xl overflow-hidden h-72 border border-zinc-800">
          <ActivityMap polyline={polyline} />
        </div>
      )}

      {/* Main stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={<Timer className="h-4 w-4" />} label="Čas" value={formatDuration(activity.duration)} />
        {activity.distance && (
          <StatCard icon={<MapPin className="h-4 w-4" />} label="Vzdálenost" value={`${(activity.distance / 1000).toFixed(2)} km`} accent="text-green-400" />
        )}
        {activity.avgHR && (
          <StatCard icon={<Heart className="h-4 w-4" />} label="Průměrná SR" value={`${activity.avgHR} bpm`} sub={activity.maxHR ? `max ${activity.maxHR} bpm` : undefined} accent="text-red-400" />
        )}
        {activity.avgPace && (
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Průměrné tempo" value={formatPace(activity.avgPace, activity.sport)} accent="text-blue-400" />
        )}
        {activity.avgPower && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="Průměrný výkon" value={`${activity.avgPower} W`} sub={activity.normalizedPower ? `NP ${activity.normalizedPower} W` : undefined} accent="text-yellow-400" />
        )}
        {activity.calories != null && activity.calories > 0 && (
          <StatCard icon={<Flame className="h-4 w-4" />} label="Kalorie" value={`${activity.calories} kcal`} />
        )}
        {activity.elevationGain != null && activity.elevationGain > 0 && (
          <StatCard icon={<Mountain className="h-4 w-4" />} label="Převýšení" value={`${activity.elevationGain.toFixed(0)} m`} accent="text-green-400" />
        )}
        {activity.trainingLoad != null && activity.trainingLoad > 0 && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Tréninkový stres" value={String(Math.round(activity.trainingLoad))} />
        )}
        {activity.avgCadence != null && activity.avgCadence > 0 && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Kadence" value={`${activity.avgCadence} spm`} accent="text-purple-400" />
        )}
        {(raw as GarminRawData).avgStrideLength && (
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Délka kroku" value={`${((raw as GarminRawData).avgStrideLength! * 100).toFixed(0)} cm`} />
        )}
        {(raw as GarminRawData).avgVerticalOscillation && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Vert. oscilace" value={`${((raw as GarminRawData).avgVerticalOscillation!).toFixed(1)} cm`} />
        )}
        {(raw as GarminRawData).avgVerticalRatio && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Vert. poměr" value={`${((raw as GarminRawData).avgVerticalRatio!).toFixed(1)} %`} />
        )}
        {(raw as GarminRawData).avgGroundContactTime && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Kontakt se zemí" value={`${Math.round((raw as GarminRawData).avgGroundContactTime!)} ms`} />
        )}
        {(raw as GarminRawData).aerobicTrainingEffect && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="Aerobní efekt" value={`${((raw as GarminRawData).aerobicTrainingEffect!).toFixed(1)}`} accent="text-blue-400" />
        )}
        {(raw as GarminRawData).anaerobicTrainingEffect && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="Anaerobní efekt" value={`${((raw as GarminRawData).anaerobicTrainingEffect!).toFixed(1)}`} accent="text-orange-400" />
        )}
        {(raw as GarminRawData).vo2MaxValue && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="VO2 Max" value={`${(raw as GarminRawData).vo2MaxValue!}`} accent="text-purple-400" />
        )}
      </div>

      {/* HR Zones */}
      {raw && <HRZones raw={raw as GarminRawData} />}

      {/* HR Chart */}
      {hr.length > 0 && (
        <ChartCard title="Srdeční rytmus" icon={<Heart className="h-4 w-4 text-red-400" />}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hr} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v as number} bpm`, 'SR']} labelFormatter={() => ''} />
              {activity.avgHR && (
                <ReferenceLine y={activity.avgHR} stroke="#3f3f46" strokeDasharray="4 4"
                  label={{ value: `avg ${activity.avgHR}`, fill: '#71717a', fontSize: 10 }} />
              )}
              <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Pace Chart */}
      {pace.length > 0 && activity.sport !== 'STRENGTH' && (
        <ChartCard title="Tempo" icon={<TrendingUp className="h-4 w-4 text-blue-400" />}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={pace} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis reversed domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }}
                tickFormatter={(v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`} />
              <Tooltip {...tooltipStyle}
                formatter={(v) => { const n = v as number; return [`${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}/km`, 'Tempo']; }}
                labelFormatter={() => ''} />
              <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Elevation Chart */}
      {elevation.length > 0 && (
        <ChartCard title="Nadmořská výška" icon={<Mountain className="h-4 w-4 text-green-400" />}>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={elevation} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => `${v}m`} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${(v as number).toFixed(0)} m`, 'Výška']} labelFormatter={() => ''} />
              <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5} fill="url(#elevGradient)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Cadence Chart */}
      {cadence.length > 0 && (
        <ChartCard title="Kadence" icon={<Activity className="h-4 w-4 text-purple-400" />}>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={cadence} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v as number} spm`, 'Kadence']} labelFormatter={() => ''} />
              <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Stride Length Chart */}
      {strideLength.length > 0 && (
        <ChartCard title="Délka kroku" icon={<TrendingUp className="h-4 w-4 text-cyan-400" />}>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={strideLength} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => `${v}cm`} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v as number} cm`, 'Délka kroku']} labelFormatter={() => ''} />
              <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Laps table */}
      {laps.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Kola / Úseky</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/80">
                  <th className="text-left px-5 py-3">#</th>
                  <th className="text-right px-4 py-3">Vzdálenost</th>
                  <th className="text-right px-4 py-3">Čas</th>
                  <th className="text-right px-4 py-3">Tempo</th>
                  <th className="text-right px-4 py-3">Pr. SR</th>
                  <th className="text-right px-4 py-3">Max SR</th>
                  <th className="text-right px-4 py-3">Kadence</th>
                  <th className="text-right px-5 py-3">Výstup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {laps.map((lap, i) => (
                  <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3 text-zinc-500 font-medium">{i + 1}</td>
                    <td className="text-right px-4 py-3 text-zinc-200">
                      {lap.distanceInMeters ? `${(lap.distanceInMeters / 1000).toFixed(2)} km` : '—'}
                    </td>
                    <td className="text-right px-4 py-3 text-zinc-200">
                      {lap.elapsedDuration ? formatDuration(Math.round(lap.elapsedDuration)) : '—'}
                    </td>
                    <td className="text-right px-4 py-3 text-blue-400 font-medium">
                      {lap.averageSpeed ? formatPace(speedToPace(lap.averageSpeed), activity.sport) : '—'}
                    </td>
                    <td className="text-right px-4 py-3 text-red-400">
                      {lap.averageHR ? `${lap.averageHR} bpm` : '—'}
                    </td>
                    <td className="text-right px-4 py-3 text-red-500">
                      {lap.maximumHR ? `${lap.maximumHR} bpm` : '—'}
                    </td>
                    <td className="text-right px-4 py-3 text-purple-400">
                      {lap.averageCadence ? `${lap.averageCadence} spm` : '—'}
                    </td>
                    <td className="text-right px-5 py-3 text-green-400">
                      {lap.totalAscent ? `↑ ${lap.totalAscent} m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
