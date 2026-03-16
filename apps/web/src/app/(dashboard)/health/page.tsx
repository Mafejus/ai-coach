'use client';

import { useState, useEffect } from 'react';
import { Heart, Moon, Zap, Battery, Activity, Wind } from 'lucide-react';
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
  stressScore: number | null;
  trainingReadiness: number | null;
  vo2max: number | null;
}

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined);
  return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

function StatCard({ label, value, unit, icon: Icon, color }: { label: string; value: number | null; unit?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs text-zinc-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-zinc-100">
        {value ?? '—'}{value !== null && unit && <span className="text-sm font-normal text-zinc-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function HealthPage() {
  const [period, setPeriod] = useState<Period>(14);
  const [data, setData] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

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

  const PERIODS: Period[] = [7, 14, 30, 90];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Zdraví</h1>
        </div>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Průměrný spánek" value={avg(data.map(d => d.sleepDuration ? Math.round(d.sleepDuration / 60) : null))} unit="h" icon={Moon} color="text-blue-400" />
        <StatCard label="Průměrné HRV" value={avg(data.map(d => d.hrvStatus))} unit="ms" icon={Heart} color="text-pink-400" />
        <StatCard label="Průměrné BB" value={avg(data.map(d => d.bodyBattery))} icon={Battery} color="text-green-400" />
        <StatCard label="Průměrná HR" value={avg(data.map(d => d.restingHR))} unit="bpm" icon={Activity} color="text-red-400" />
        <StatCard label="Průměrný stres" value={avg(data.map(d => d.stressScore))} icon={Wind} color="text-orange-400" />
        <StatCard label="Readiness" value={avg(data.map(d => d.trainingReadiness))} icon={Zap} color="text-yellow-400" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-52 animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Moon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Žádná zdravotní data za dané období.</p>
          <p className="text-sm mt-1">Propoj Garmin a spusť sync v nastavení.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><Moon className="h-4 w-4 text-blue-400" />Spánek</h3>
            <SleepChart data={data} />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-pink-400" />HRV</h3>
            <HRVChart data={data} />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><Battery className="h-4 w-4 text-green-400" />Body Battery</h3>
            <BodyBatteryChart data={data} />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-red-400" />Klidová tepovka</h3>
            <RestingHRChart data={data} />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" />Training Readiness</h3>
            <TrainingReadinessChart data={data} />
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><Wind className="h-4 w-4 text-orange-400" />Stres</h3>
            <StressChart data={data} />
          </div>
        </div>
      )}
    </div>
  );
}
