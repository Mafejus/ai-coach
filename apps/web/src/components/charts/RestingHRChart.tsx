'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DataPoint { date: string; restingHR: number | null; }
interface Props { data: DataPoint[] }

export function RestingHRChart({ data }: Props) {
  const filtered = data.filter(d => d.restingHR !== null);
  const avg = filtered.length > 0
    ? Math.round(filtered.reduce((s, d) => s + (d.restingHR ?? 0), 0) / filtered.length)
    : null;

  const chartData = filtered.map(d => ({
    date: format(new Date(d.date), 'dd.MM'),
    hr: d.restingHR,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '12px' }} />
        {avg && <ReferenceLine y={avg} stroke="#6b7280" strokeDasharray="3 3" />}
        <Line type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
