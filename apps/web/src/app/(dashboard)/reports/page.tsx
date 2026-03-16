import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ai-coach/db';
import { FileText } from 'lucide-react';
import { DailyReportSection } from '@/components/dashboard/DailyReportSection';

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const reports = await prisma.dailyReport.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 30,
    select: { id: true, date: true, markdown: true, createdAt: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayReport = reports.find(r => new Date(r.date).getTime() === today.getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-orange-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Ranní reporty</h1>
      </div>

      {/* Today's report with generate button */}
      <DailyReportSection initialReport={todayReport?.markdown ?? null} />

      {/* History */}
      {reports.filter(r => new Date(r.date).getTime() !== today.getTime()).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Historie</h2>
          {reports
            .filter(r => new Date(r.date).getTime() !== today.getTime())
            .map(r => (
              <details key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="text-sm font-medium text-zinc-100">
                    {new Date(r.date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <span className="text-xs text-zinc-500 group-open:hidden">Zobrazit</span>
                  <span className="text-xs text-zinc-500 hidden group-open:inline">Skrýt</span>
                </summary>
                <div className="px-4 pb-4 pt-0 border-t border-zinc-800">
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-headings:text-zinc-100 text-zinc-300 mt-3">
                    {r.markdown}
                  </div>
                </div>
              </details>
            ))}
        </div>
      )}

      {reports.length === 0 && (
        <div className="text-center py-16 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Žádné reporty zatím.</p>
          <p className="text-sm mt-1">První report bude vygenerován zítra ráno v 6:00, nebo ho můžeš vygenerovat teď.</p>
        </div>
      )}
    </div>
  );
}
