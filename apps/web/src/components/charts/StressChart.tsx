'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DataPoint { date: string; stressScore: number | null; }
interface Props { data: DataPoint[] }

export function StressChart({ data }: Props) {
  const chartData = data
    .filter(d => d.stressScore !== null)
    .map(d => ({
      date: format(new Date(d.date), 'dd.MM'),
      stress: d.stressScore,
    }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <defs>
          <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '12px' }} />
        <Area type="monotone" dataKey="stress" stroke="#f97316" strokeWidth={2} fill="url(#stressGradient)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
