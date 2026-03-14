import { Calendar } from 'lucide-react';

export default function TrainingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Tréninkový plán</h1>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-muted-foreground text-sm">
          Tréninkový plán bude implementován v Fázi 3. AI agent bude generovat týdenní plány přizpůsobené tvým datům.
        </p>
      </div>
    </div>
  );
}
