import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ai-coach/db';
import { Sun, ChevronDown } from 'lucide-react';
import { DailyReportSection } from '@/components/dashboard/DailyReportSection';
import ReactMarkdown from 'react-markdown';

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const reports = await prisma.dailyReport.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'desc' },
    take: 30,
    select: { id: true, date: true, markdown: true, createdAt: true, aiModel: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayReport = reports.find(r => new Date(r.date).getTime() === today.getTime());
  const historyReports = reports.filter(r => new Date(r.date).getTime() !== today.getTime());

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-orange-500/10 rounded-xl border border-orange-500/20">
              <Sun className="h-5 w-5 text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Ranní briefingy</h1>
          </div>
          <p className="text-zinc-500 text-sm pl-1">Denní AI analýza tvého tréninku a recovery</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Dnes</p>
          <p className="text-sm font-medium text-zinc-300">
            {today.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Today's report */}
      <DailyReportSection initialReport={todayReport?.markdown ?? null} />

      {/* History */}
      {historyReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">
            Historie ({historyReports.length})
          </h2>

          <div className="space-y-2">
            {historyReports.map(r => {
              const date = new Date(r.date);
              const dayLabel = date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
              const isRecent = (today.getTime() - date.getTime()) < 7 * 86400000;

              return (
                <details
                  key={r.id}
                  className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden transition-all hover:border-zinc-700"
                >
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isRecent ? 'bg-orange-500/60' : 'bg-zinc-700'}`} />
                      <div>
                        <span className="text-sm font-semibold text-zinc-100 capitalize">{dayLabel}</span>
                        {r.aiModel && (
                          <span className="ml-2 text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">
                            {r.aiModel}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-zinc-500 group-open:rotate-180 transition-transform duration-200 shrink-0" />
                  </summary>

                  <div className="border-t border-zinc-800 px-5 py-5">
                    <div className="prose prose-invert prose-sm max-w-none
                      prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-zinc-100
                      prose-h1:text-lg prose-h1:mt-0
                      prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-zinc-400
                      prose-h2:mt-5 prose-h2:mb-2 prose-h2:first:mt-0
                      prose-h3:text-sm prose-h3:text-zinc-200
                      prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-2
                      prose-ul:my-2 prose-li:text-zinc-300 prose-li:leading-relaxed prose-li:marker:text-orange-500/50
                      prose-strong:text-zinc-100 prose-strong:font-semibold
                      prose-hr:border-zinc-800 prose-hr:my-3
                      prose-blockquote:border-l-2 prose-blockquote:border-orange-500/40
                      prose-blockquote:bg-orange-500/5 prose-blockquote:rounded-r-xl
                      prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:not-italic
                      prose-blockquote:text-zinc-300
                    ">
                      <ReactMarkdown>{r.markdown ?? ''}</ReactMarkdown>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {reports.length === 0 && (
        <div className="text-center py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
          <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20 w-fit mx-auto mb-4">
            <Sun className="h-10 w-10 text-orange-400/50" />
          </div>
          <p className="font-semibold text-zinc-400">Zatím žádné briefingy</p>
          <p className="text-sm text-zinc-600 mt-1 max-w-xs mx-auto">
            První report vygeneruj kliknutím výše, nebo bude automaticky vytvořen zítra ráno v 6:00.
          </p>
        </div>
      )}
    </div>
  );
}
