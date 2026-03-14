import { AlertTriangle } from 'lucide-react';

export default function InjuriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Zranění</h1>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm">
          Správa zranění a AI-generovaná omezení budou implementována v Fázi 4.
        </p>
      </div>
    </div>
  );
}
