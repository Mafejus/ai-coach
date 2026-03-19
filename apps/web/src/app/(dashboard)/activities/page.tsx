'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Timer, Route, Heart, ChevronRight, TrendingUp } from 'lucide-react';
import { formatDuration } from '@ai-coach/shared';

type SportFilter = 'ALL' | 'RUN' | 'BIKE' | 'SWIM' | 'STRENGTH';
type PeriodFilter = '7' | '30' | '90' | 'all';
type SourceFilter = 'ALL' | 'GARMIN' | 'STRAVA';

interface ActivityItem {
  id: string;
  sport: string;
  name: string | null;
  date: string;
  duration: number;
  distance: number | null;
  avgHR: number | null;
  avgPace: number | null;
  avgPower: number | null;
  trainingLoad: number | null;
  source: string;
  calories: number | null;
  rawData: { garminActivityId?: string } | null;
}

const SPORT_ICONS: Record<string, string> = { RUN: '🏃', BIKE: '🚴', SWIM: '🏊', STRENGTH: '🏋️', TRIATHLON: '🏅', OTHER: '⚡' };

const SPORT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  RUN:      { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400' },
  BIKE:     { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400' },
  SWIM:     { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-400' },
  STRENGTH: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' },
  TRIATHLON:{ bg: 'bg-green-500/10',  border: 'border-green-500/20',  text: 'text-green-400' },
  OTHER:    { bg: 'bg-zinc-800/60',   border: 'border-zinc-700/50',   text: 'text-zinc-400' },
};

function formatPaceDisplay(secPerKm: number | null, sport: string): string {
  if (!secPerKm) return '—';
  if (sport === 'SWIM') {
    const s = secPerKm / 100;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}/100m`;
  }
  return `${Math.floor(secPerKm / 60)}:${String(Math.floor(secPerKm % 60)).padStart(2, '0')}/km`;
}


export default function ActivitiesPage() {
  const router = useRouter();
  const [sport, setSport] = useState<SportFilter>('ALL');
  const [period, setPeriod] = useState<PeriodFilter>('30');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sport !== 'ALL') params.set('sport', sport);
    if (source !== 'ALL') params.set('source', source);
    if (period !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(period));
      params.set('from', from.toISOString().split('T')[0]!);
    }
    params.set('limit', '100');
    fetch(`/api/activities?${params}`)
      .then(r => r.json() as Promise<ActivityItem[]>)
      .then(d => { setActivities(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sport, period, source]);

  const totalKm = activities.reduce((s, a) => s + (a.distance ? a.distance / 1000 : 0), 0);
  const totalHours = activities.reduce((s, a) => s + a.duration, 0) / 3600;

  const SPORT_FILTERS: { key: SportFilter; label: string }[] = [
    { key: 'ALL', label: 'Vše' },
    { key: 'RUN', label: '🏃 Běh' },
    { key: 'BIKE', label: '🚴 Kolo' },
    { key: 'SWIM', label: '🏊 Plavání' },
    { key: 'STRENGTH', label: '🏋️ Síla' },
  ];

  const PERIOD_FILTERS: { key: PeriodFilter; label: string }[] = [
    { key: '7', label: '7 dní' },
    { key: '30', label: '30 dní' },
    { key: '90', label: '90 dní' },
    { key: 'all', label: 'Vše' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Aktivity</h1>
          </div>
          <p className="text-zinc-500 text-sm pl-1">Historie tréninků a výkonnostní data</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Aktivit</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{activities.length}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Route className="h-3.5 w-3.5 text-green-400" />
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Celkem</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{totalKm.toFixed(0)} <span className="text-sm font-normal text-zinc-400">km</span></p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Timer className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Hodin</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{totalHours.toFixed(1)} <span className="text-sm font-normal text-zinc-400">h</span></p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Sport filter */}
        <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1">
          {SPORT_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setSport(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                sport === f.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1">
          {PERIOD_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setPeriod(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                period === f.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1">
          {(['ALL', 'GARMIN', 'STRAVA'] as SourceFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                source === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              {s === 'ALL' ? 'Všechny zdroje' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
          <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 w-fit mx-auto mb-4">
            <Activity className="h-10 w-10 text-blue-400/50" />
          </div>
          <p className="font-semibold text-zinc-400">Žádné aktivity za dané období</p>
          <p className="text-sm text-zinc-600 mt-1">Zkus změnit filtr nebo synchronizovat Garmin / Strava.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const colors = SPORT_COLORS[a.sport] ?? SPORT_COLORS.OTHER!;
            const loadVal = a.trainingLoad ?? 0;
            const loadCfg = loadVal === 0
              ? null
              : loadVal < 50
              ? { label: 'Easy',     cls: 'bg-green-500/15  text-green-400  border-green-500/25' }
              : loadVal < 100
              ? { label: 'Moderate', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' }
              : { label: 'Hard',     cls: 'bg-red-500/15    text-red-400    border-red-500/25' };

            return (
              <button
                key={a.id}
                onClick={() => router.push(`/activities/${a.id}`)}
                className="group w-full flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-zinc-700 hover:bg-zinc-900/80 transition-all text-left"
              >
                {/* Sport icon */}
                <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl border ${colors.bg} ${colors.border}`}>
                  {SPORT_ICONS[a.sport] ?? '⚡'}
                </div>

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white">
                    {a.name ?? a.sport}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(a.date).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}
                    <span className={colors.text}>{a.sport}</span>
                  </p>
                </div>

                {/* Stats row */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {formatDuration(a.duration)}
                  </span>
                  {a.distance && (
                    <span className="flex items-center gap-1">
                      <Route className="h-3 w-3" />
                      {(a.distance / 1000).toFixed(1)} km
                    </span>
                  )}
                  {a.avgHR && (
                    <span className="flex items-center gap-1 text-red-400">
                      <Heart className="h-3 w-3" />
                      {a.avgHR}
                    </span>
                  )}
                  {a.avgPace && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {formatPaceDisplay(a.avgPace, a.sport)}
                    </span>
                  )}
                </div>

                {/* Right side: load + source */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {loadCfg && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${loadCfg.cls}`}>
                      {loadCfg.label}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
                    {a.rawData?.garminActivityId ? 'Garmin' : a.source}
                  </span>
                </div>

                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
