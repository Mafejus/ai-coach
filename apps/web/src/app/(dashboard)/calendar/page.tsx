import { CalendarDays } from 'lucide-react';

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Kalendář</h1>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm">
          Denní přehled s kalendářem a tréninkovým plánem bude dostupný po implementaci Fáze 1.
        </p>
      </div>
    </div>
  );
}
