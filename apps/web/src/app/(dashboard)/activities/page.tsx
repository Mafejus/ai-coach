import { Activity } from 'lucide-react';

export default function ActivitiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Aktivity</h1>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm">
          Historie aktivit z Garmin a Strava bude dostupná po implementaci Fáze 1.
        </p>
      </div>
    </div>
  );
}
