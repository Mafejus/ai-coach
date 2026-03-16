'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  trainingReadiness: number | null;
}

interface Props { data: DataPoint[] }

export function TrainingReadinessChart({ data }: Props) {
  const chartData = data
    .filter(d => d.trainingReadiness !== null)
    .map(d => ({
      date: format(new Date(d.date), 'dd.MM'),
      value: d.trainingReadiness,
    }));

  const getColor = (value: number) => {
    if (value >= 60) return '#22c55e';
    if (value >= 30) return '#eab308';
    return '#ef4444';
  };

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: '6px', fontSize: '12px' }} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.value ?? 0)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
