'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  bodyBattery: number | null;
}

interface Props {
  data: DataPoint[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs">
      <p className="text-zinc-400">{label}</p>
      <p className="text-white font-medium">{payload[0]?.value ?? '—'}</p>
    </div>
  );
};

export function BodyBatteryChart({ data }: Props) {
  const chartData = data
    .filter(d => d.bodyBattery !== null)
    .map(d => ({
      date: format(new Date(d.date), 'dd.MM'),
      value: d.bodyBattery,
    }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <defs>
          <linearGradient id="bbGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={60} stroke="#3f3f46" strokeDasharray="3 3" />
        <ReferenceLine y={30} stroke="#3f3f46" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#bbGradient)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
