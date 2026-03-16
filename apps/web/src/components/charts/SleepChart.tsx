'use client';
import { XAxis, YAxis, Tooltip, Bar, Line, ComposedChart, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  sleepScore: number | null;
  sleepDuration: number | null;
  deepSleep: number | null;
  remSleep: number | null;
  lightSleep: number | null;
  awakeDuration: number | null;
}

interface Props { data: DataPoint[] }

export function SleepChart({ data }: Props) {
  const chartData = data
    .filter(d => d.sleepDuration !== null)
    .map(d => ({
      date: format(new Date(d.date), 'dd.MM'),
      deep: d.deepSleep ? +(d.deepSleep / 60).toFixed(1) : 0,
      rem: d.remSleep ? +(d.remSleep / 60).toFixed(1) : 0,
      light: d.lightSleep ? +(d.lightSleep / 60).toFixed(1) : 0,
      awake: d.awakeDuration ? +(d.awakeDuration / 60).toFixed(1) : 0,
      score: d.sleepScore,
    }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs space-y-1">
        <p className="text-zinc-400 font-medium">{label}</p>
        {payload.map(p => (
          <div key={p.name} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="text-white">{p.name === 'score' ? p.value : `${p.value}h`}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="hours" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="score" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar yAxisId="hours" dataKey="deep" stackId="sleep" fill="#1d4ed8" name="deep" radius={[0,0,0,0]} />
        <Bar yAxisId="hours" dataKey="rem" stackId="sleep" fill="#7c3aed" name="rem" />
        <Bar yAxisId="hours" dataKey="light" stackId="sleep" fill="#60a5fa" name="light" />
        <Bar yAxisId="hours" dataKey="awake" stackId="sleep" fill="#ef4444" name="awake" radius={[3,3,0,0]} />
        <Line yAxisId="score" type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} dot={false} name="score" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
