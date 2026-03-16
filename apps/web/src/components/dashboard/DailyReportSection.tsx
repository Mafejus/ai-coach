'use client';

import { useState } from 'react';

interface Props {
  initialReport: string | null;
}

export function DailyReportSection({ initialReport }: Props) {
  const [report, setReport] = useState<string | null>(initialReport);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { markdown: string };
        setReport(data.markdown);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!report) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-100">🌅 Ranní briefing</p>
          <p className="text-xs text-zinc-400 mt-0.5">Report ještě nebyl vygenerován</p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {loading ? 'Generuji...' : 'Vygenerovat teď'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-zinc-100 flex items-center gap-2">🌅 Ranní briefing</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs text-zinc-400 hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Obnovuji...' : '↻ Obnovit'}
        </button>
      </div>
      <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
        {report}
      </div>
    </div>
  );
}
