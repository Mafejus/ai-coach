'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  hrvStatus: number | null;
  hrvBaseline: number | null;
}

interface Props {
  data: DataPoint[];
}

export function HRVChart({ data }: Props) {
  const baseline = data.find(d => d.hrvBaseline)?.hrvBaseline ?? null;

  const chartData = data
    .filter(d => d.hrvStatus !== null)
    .map(d => ({
      date: format(new Date(d.date), 'dd.MM'),
      hrv: d.hrvStatus,
      baseline: d.hrvBaseline ?? baseline,
    }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    const hrv = payload.find(p => p.name === 'hrv')?.value;
    const bl = payload.find(p => p.name === 'baseline')?.value ?? baseline;
    const diff = hrv && bl ? Math.round(((hrv - bl) / bl) * 100) : null;
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs space-y-1">
        <p className="text-zinc-400">{label}</p>
        <p className="text-white font-medium">HRV: {hrv} ms</p>
        {diff !== null && (
          <p className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
            {diff >= 0 ? '+' : ''}{diff}% vs baseline
          </p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <defs>
          <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {baseline && <ReferenceLine y={baseline} stroke="#6b7280" strokeDasharray="4 4" label={{ value: 'baseline', fill: '#6b7280', fontSize: 10 }} />}
        <Area type="monotone" dataKey="hrv" stroke="#3b82f6" strokeWidth={2} fill="url(#hrvGradient)" dot={false} name="hrv" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
