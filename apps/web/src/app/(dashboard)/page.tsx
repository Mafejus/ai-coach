import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {['Body Battery', 'Spánek', 'HRV', 'Training Readiness'].map((metric) => (
          <div key={metric} className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{metric}</p>
            <p className="text-2xl font-bold text-foreground mt-1">—</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm">
          Dashboard overview — data se zobrazí po implementaci Fáze 1 (Data Pipeline)
        </p>
      </div>
    </div>
  );
}
