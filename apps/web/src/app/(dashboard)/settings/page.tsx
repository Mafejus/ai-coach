import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Nastavení</h1>
      </div>
      <div className="space-y-4">
        {['Profil', 'Garmin Connect', 'Strava', 'Google Kalendář', 'Push notifikace'].map((section) => (
          <div key={section} className="bg-card border border-border rounded-lg p-4">
            <h2 className="font-medium text-foreground">{section}</h2>
            <p className="text-sm text-muted-foreground mt-1">Implementace v Fázi 1</p>
          </div>
        ))}
      </div>
    </div>
  );
}
