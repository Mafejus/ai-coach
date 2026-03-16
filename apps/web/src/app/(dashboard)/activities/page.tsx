'use client';

import { useState, useEffect } from 'react';
import { Activity, Filter } from 'lucide-react';
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

function formatPaceDisplay(secPerKm: number | null, sport: string): string {
  if (!secPerKm) return '—';
  if (sport === 'SWIM') {
    const min = Math.floor(secPerKm / 100 / 60);
    const sec = Math.floor((secPerKm / 100) % 60);
    return `${min}:${String(sec).padStart(2, '0')}/100m`;
  }
  const min = Math.floor(secPerKm / 60);
  const sec = Math.floor(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')}/km`;
}

function getLoadLabel(load: number | null): { label: string; color: string } {
  if (!load) return { label: '—', color: 'text-zinc-500' };
  if (load < 50) return { label: 'Easy', color: 'text-green-400' };
  if (load < 100) return { label: 'Moderate', color: 'text-yellow-400' };
  return { label: 'Hard', color: 'text-red-400' };
}

export default function ActivitiesPage() {
  const [sport, setSport] = useState<SportFilter>('ALL');
  const [period, setPeriod] = useState<PeriodFilter>('30');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActivityItem | null>(null);

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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-blue-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Aktivity</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-zinc-100">{activities.length}</p>
          <p className="text-xs text-zinc-400">aktivit</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-zinc-100">{totalKm.toFixed(0)} km</p>
          <p className="text-xs text-zinc-400">celkem</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-zinc-100">{totalHours.toFixed(1)}h</p>
          <p className="text-xs text-zinc-400">hodin</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(['ALL', 'RUN', 'BIKE', 'SWIM', 'STRENGTH'] as SportFilter[]).map(s => (
            <button key={s} onClick={() => setSport(s)} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${sport === s ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}>
              {s === 'ALL' ? 'Vše' : SPORT_ICONS[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(['7', '30', '90', 'all'] as PeriodFilter[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}>
              {p === 'all' ? 'Vše' : `${p}d`}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(['ALL', 'GARMIN', 'STRAVA'] as SourceFilter[]).map(s => (
            <button key={s} onClick={() => setSource(s)} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${source === s ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}>
              {s === 'ALL' ? 'Všechny' : s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Žádné aktivity za dané období.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const load = getLoadLabel(a.trainingLoad);
            return (
              <button
                key={a.id}
                onClick={() => setSelected(a)}
                className="w-full flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors text-left"
              >
                <span className="text-2xl">{SPORT_ICONS[a.sport] ?? '⚡'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{a.name ?? a.sport}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(a.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="hidden sm:flex gap-4 text-xs text-zinc-400">
                  <span>{formatDuration(a.duration)}</span>
                  {a.distance && <span>{(a.distance / 1000).toFixed(1)} km</span>}
                  {a.avgHR && <span className="text-red-400">♥ {a.avgHR}</span>}
                  {a.avgPace && <span>{formatPaceDisplay(a.avgPace, a.sport)}</span>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs ${load.color}`}>{load.label}</span>
                  {a.rawData?.garminActivityId
                    ? <span className="text-xs text-purple-400">Garmin + Strava</span>
                    : <span className="text-xs text-zinc-500">{a.source}</span>
                  }
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Activity detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{SPORT_ICONS[selected.sport] ?? '⚡'}</span>
                <div>
                  <h3 className="font-semibold text-zinc-100">{selected.name ?? selected.sport}</h3>
                  <p className="text-xs text-zinc-400">{new Date(selected.date).toLocaleDateString('cs-CZ')}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-100 text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Čas', value: formatDuration(selected.duration) },
                { label: 'Vzdálenost', value: selected.distance ? `${(selected.distance / 1000).toFixed(2)} km` : '—' },
                { label: 'Průměrná HR', value: selected.avgHR ? `${selected.avgHR} bpm` : '—' },
                { label: 'Tempo/Pace', value: formatPaceDisplay(selected.avgPace, selected.sport) },
                { label: 'Výkon', value: selected.avgPower ? `${selected.avgPower}W` : '—' },
                { label: 'Kalorie', value: selected.calories ? `${selected.calories} kcal` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-xs text-zinc-400">{label}</p>
                  <p className="text-sm font-medium text-zinc-100 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 text-right">
              Zdroj: {selected.rawData?.garminActivityId ? 'Garmin + Strava' : selected.source}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
