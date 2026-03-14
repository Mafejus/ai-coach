import { Heart } from 'lucide-react';

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Zdraví</h1>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm">
          Zdravotní metriky (spánek, HRV, Body Battery) budou zobrazeny po implementaci Fáze 2.
        </p>
      </div>
    </div>
  );
}
