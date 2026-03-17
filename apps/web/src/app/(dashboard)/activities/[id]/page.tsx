'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Zap, Timer, MapPin, Flame, TrendingUp, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import dynamic from 'next/dynamic';
import { formatDuration } from '@ai-coach/shared';

// Map must be loaded client-side only (no SSR)
const ActivityMap = dynamic(() => import('@/components/activities/ActivityMap'), { ssr: false });

const SPORT_ICONS: Record<string, string> = { RUN: '🏃', BIKE: '🚴', SWIM: '🏊', STRENGTH: '🏋️', TRIATHLON: '🏅', OTHER: '⚡' };

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
  // Garmin activity-level fields
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
    const s = secPerKm / 10; // sec/100m
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}/100m`;
  }
  return `${Math.floor(secPerKm / 60)}:${String(Math.floor(secPerKm % 60)).padStart(2, '0')}/km`;
}

function speedToPace(speedMs: number | undefined): number | null {
  if (!speedMs || speedMs <= 0) return null;
  return 1000 / speedMs; // sec/km
}

// Parse time-series from Garmin metrics format
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
      if (s > 0) strideLength.push({ t, v: Math.round(s * 100) }); // convert to cm
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

function StatCard({ icon, label, value, color = 'text-zinc-100' }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-zinc-800/60 rounded-xl p-4 flex items-center gap-3">
      <div className="text-zinc-400">{icon}</div>
      <div>
        <p className="text-xs text-zinc-400">{label}</p>
        <p className={`text-base font-semibold ${color}`}>{value}</p>
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
        <Heart className="h-4 w-4 text-red-400" /> Čas v tepových zónách
      </h3>
      <div className="space-y-2">
        {zones.map((secs, i) => (
          secs > 0 ? (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="w-20 text-zinc-400">{HR_ZONE_LABELS[i]}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${(secs / total) * 100}%`, backgroundColor: HR_ZONE_COLORS[i] }}
                />
              </div>
              <span className="w-14 text-right text-zinc-200">{formatDuration(Math.round(secs))}</span>
            </div>
          ) : null
        ))}
      </div>
      {/* Stacked bar */}
      <div className="mt-3 flex h-3 rounded-full overflow-hidden gap-px">
        {zones.map((secs, i) => secs > 0 ? (
          <div key={i} style={{ width: `${(secs / total) * 100}%`, backgroundColor: HR_ZONE_COLORS[i] }} />
        ) : null)}
      </div>
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
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="h-64 bg-zinc-800 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!activity) {
    return <div className="text-center py-16 text-zinc-400">Aktivita nenalezena.</div>;
  }

  const raw = activity.rawData ?? {};
  const details = raw.details;
  const polyline = details?.geoPolylineDTO?.polyline;
  const { hr, pace, elevation, cadence, strideLength } = parseMetrics(details);
  const laps = activity.laps ?? [];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl">{SPORT_ICONS[activity.sport] ?? '⚡'}</span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-zinc-100 truncate">{activity.name ?? activity.sport}</h1>
            <p className="text-sm text-zinc-400">
              {new Date(activity.date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              {new Date(activity.date).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      {polyline && polyline.length > 0 && (
        <div className="rounded-xl overflow-hidden h-72 border border-zinc-800">
          <ActivityMap polyline={polyline} />
        </div>
      )}

      {/* Main stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Timer className="h-4 w-4" />} label="Čas" value={formatDuration(activity.duration)} />
        {activity.distance && (
          <StatCard icon={<MapPin className="h-4 w-4" />} label="Vzdálenost" value={`${(activity.distance / 1000).toFixed(2)} km`} />
        )}
        {activity.avgHR && (
          <StatCard icon={<Heart className="h-4 w-4" />} label="Průměrná SR" value={`${activity.avgHR} bpm`} color="text-red-400" />
        )}
        {activity.maxHR && (
          <StatCard icon={<Heart className="h-4 w-4" />} label="Max SR" value={`${activity.maxHR} bpm`} color="text-red-500" />
        )}
        {activity.avgPace && (
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Průměrné tempo" value={formatPace(activity.avgPace, activity.sport)} />
        )}
        {activity.avgPower && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="Průměrný výkon" value={`${activity.avgPower} W`} color="text-yellow-400" />
        )}
        {activity.calories && (
          <StatCard icon={<Flame className="h-4 w-4" />} label="Kalorie" value={`${activity.calories} kcal`} />
        )}
        {activity.elevationGain && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Převýšení" value={`${activity.elevationGain.toFixed(0)} m`} color="text-green-400" />
        )}
        {activity.trainingLoad && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Tréninkový stres" value={String(Math.round(activity.trainingLoad))} />
        )}
        {activity.avgCadence && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Kadence" value={`${activity.avgCadence} spm`} />
        )}
        {raw.avgStrideLength && (
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Délka kroku" value={`${(raw.avgStrideLength as number * 100).toFixed(0)} cm`} />
        )}
        {raw.avgVerticalOscillation && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Vert. oscilace" value={`${(raw.avgVerticalOscillation as number).toFixed(1)} cm`} />
        )}
        {raw.avgVerticalRatio && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Vert. poměr" value={`${(raw.avgVerticalRatio as number).toFixed(1)} %`} />
        )}
        {raw.avgGroundContactTime && (
          <StatCard icon={<Activity className="h-4 w-4" />} label="Kontakt se zemí" value={`${Math.round(raw.avgGroundContactTime as number)} ms`} />
        )}
        {raw.aerobicTrainingEffect && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="Aerobní efekt" value={`${(raw.aerobicTrainingEffect as number).toFixed(1)}`} color="text-blue-400" />
        )}
        {raw.anaerobicTrainingEffect && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="Anaerobní efekt" value={`${(raw.anaerobicTrainingEffect as number).toFixed(1)}`} color="text-orange-400" />
        )}
        {raw.vo2MaxValue && (
          <StatCard icon={<Zap className="h-4 w-4" />} label="VO2 Max" value={`${raw.vo2MaxValue as number}`} color="text-purple-400" />
        )}
      </div>

      {/* HR Zones */}
      {raw && <HRZones raw={raw as GarminRawData} />}

      {/* HR Chart */}
      {hr.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-400" /> Srdeční rytmus v průběhu aktivity
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hr} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                formatter={(v) => [`${v as number} bpm`, 'SR']}
                labelFormatter={() => ''}
              />
              {activity.avgHR && <ReferenceLine y={activity.avgHR} stroke="#3f3f46" strokeDasharray="4 4" label={{ value: `avg ${activity.avgHR}`, fill: '#71717a', fontSize: 10 }} />}
              <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pace Chart */}
      {pace.length > 0 && activity.sport !== 'STRENGTH' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-400" /> Tempo v průběhu aktivity
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={pace} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis reversed domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }}
                tickFormatter={(v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                formatter={(v) => { const n = v as number; return [`${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}/km`, 'Tempo']; }}
                labelFormatter={() => ''}
              />
              <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Elevation Chart */}
      {elevation.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-400" /> Nadmořská výška
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={elevation} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => `${v}m`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                formatter={(v) => [`${(v as number).toFixed(0)} m`, 'Výška']}
                labelFormatter={() => ''}
              />
              <Line type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cadence Chart */}
      {cadence.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-400" /> Kadence v průběhu aktivity
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={cadence} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => `${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                formatter={(v) => [`${v as number} spm`, 'Kadence']}
                labelFormatter={() => ''}
              />
              <Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stride Length Chart */}
      {strideLength.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" /> Délka kroku v průběhu aktivity
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={strideLength} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="t" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={(v: number) => `${v}cm`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                formatter={(v) => [`${v as number} cm`, 'Délka kroku']}
                labelFormatter={() => ''}
              />
              <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Laps table */}
      {laps.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">Kola / Úseky</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-800">
                  <th className="text-left py-2 pr-4">#</th>
                  <th className="text-right pr-4">Vzdálenost</th>
                  <th className="text-right pr-4">Čas</th>
                  <th className="text-right pr-4">Tempo</th>
                  <th className="text-right pr-4">Pr. SR</th>
                  <th className="text-right pr-4">Max SR</th>
                  <th className="text-right pr-4">Kadence</th>
                  <th className="text-right">Výstup</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((lap, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 pr-4 text-zinc-400">{i + 1}</td>
                    <td className="text-right pr-4 text-zinc-200">
                      {lap.distanceInMeters ? `${(lap.distanceInMeters / 1000).toFixed(2)} km` : '—'}
                    </td>
                    <td className="text-right pr-4 text-zinc-200">
                      {lap.elapsedDuration ? formatDuration(Math.round(lap.elapsedDuration)) : '—'}
                    </td>
                    <td className="text-right pr-4 text-blue-400">
                      {lap.averageSpeed ? formatPace(speedToPace(lap.averageSpeed), activity.sport) : '—'}
                    </td>
                    <td className="text-right pr-4 text-red-400">
                      {lap.averageHR ? `${lap.averageHR} bpm` : '—'}
                    </td>
                    <td className="text-right pr-4 text-red-500">
                      {lap.maximumHR ? `${lap.maximumHR} bpm` : '—'}
                    </td>
                    <td className="text-right pr-4 text-purple-400">
                      {lap.averageCadence ? `${lap.averageCadence} spm` : '—'}
                    </td>
                    <td className="text-right text-green-400">
                      {lap.totalAscent ? `↑${lap.totalAscent}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source */}
      <p className="text-xs text-zinc-500 text-right">Zdroj: {activity.source}</p>
    </div>
  );
}
