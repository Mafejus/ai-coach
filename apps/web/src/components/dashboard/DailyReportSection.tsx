'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sun, RefreshCw, Sparkles, Loader2, Send, MessageSquare, RotateCcw } from 'lucide-react';

interface Props {
  initialReport: string | null;
}

type LoadingState = 'idle' | 'generating' | 'refining';

export function DailyReportSection({ initialReport }: Props) {
  const [report, setReport] = useState<string | null>(initialReport);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [revised, setRevised] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [feedback]);

  const generate = async () => {
    setLoading('generating');
    setError(null);
    setRevised(false);
    try {
      const res = await fetch('/api/reports/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json() as { markdown: string };
        setReport(data.markdown);
      } else {
        setError('Generování se nezdařilo. Zkus to znovu.');
      }
    } catch {
      setError('Chyba připojení.');
    } finally {
      setLoading('idle');
    }
  };

  const refine = async () => {
    if (!feedback.trim() || loading !== 'idle') return;
    setLoading('refining');
    setError(null);
    try {
      const res = await fetch('/api/reports/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      if (res.ok) {
        const data = await res.json() as { markdown: string };
        setReport(data.markdown);
        setFeedback('');
        setRevised(true);
      } else {
        setError('Úprava se nezdařila. Zkus to znovu.');
      }
    } catch {
      setError('Chyba připojení.');
    } finally {
      setLoading('idle');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void refine();
    }
  };

  // Full-screen loading states
  if (loading === 'generating') {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl animate-pulse" />
          <div className="relative p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
            <Loader2 className="h-7 w-7 text-orange-400 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-200">Generuji ranní briefing</p>
          <p className="text-xs text-zinc-500 mt-1">AI analyzuje tvá data a připravuje doporučení…</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="relative overflow-hidden bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/15 rounded-xl border border-orange-500/25">
              <Sun className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-100">Ranní briefing</p>
              <p className="text-xs text-zinc-500 mt-0.5">Dnešní report ještě nebyl vygenerován</p>
            </div>
          </div>
          <button
            onClick={generate}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-colors self-start sm:self-auto"
          >
            <Sparkles className="h-4 w-4" />
            Vygenerovat teď
          </button>
        </div>
        {error && (
          <p className="relative mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/12 via-amber-500/6 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/15 rounded-xl border border-orange-500/25">
              <Sun className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-zinc-100 tracking-tight">Ranní briefing</h2>
                {revised && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    Upraveno
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5 uppercase tracking-wider">
                {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <button
            onClick={generate}
            disabled={loading !== 'idle'}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-40 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800 border border-transparent hover:border-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Obnovit</span>
          </button>
        </div>
      </div>

      {/* Report content */}
      <div className="p-5 sm:p-6">
        <div className={`prose prose-invert prose-sm max-w-none transition-opacity duration-300 ${loading === 'refining' ? 'opacity-40' : 'opacity-100'}
          prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-zinc-100
          prose-h1:text-lg prose-h1:mt-0
          prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-zinc-400
          prose-h2:mt-6 prose-h2:mb-3 prose-h2:first:mt-0
          prose-h3:text-sm prose-h3:text-zinc-200
          prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-2
          prose-ul:my-2 prose-ul:space-y-1
          prose-li:text-zinc-300 prose-li:leading-relaxed prose-li:marker:text-orange-500/60
          prose-strong:text-zinc-100 prose-strong:font-semibold
          prose-em:text-zinc-400 prose-em:not-italic prose-em:text-xs
          prose-hr:border-zinc-800 prose-hr:my-4
          prose-blockquote:border-l-2 prose-blockquote:border-orange-500/50
          prose-blockquote:bg-orange-500/5 prose-blockquote:rounded-r-xl
          prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:my-3
          prose-blockquote:not-italic prose-blockquote:text-zinc-200
        `}>
          <ReactMarkdown>{report}</ReactMarkdown>
        </div>
      </div>

      {/* Refining overlay */}
      {loading === 'refining' && (
        <div className="mx-5 mb-5 -mt-2 flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
          <p className="text-sm text-blue-300">AI přepisuje report na základě tvé zpětné vazby…</p>
        </div>
      )}

      {/* Feedback input */}
      {loading !== 'refining' && (
        <div className="border-t border-zinc-800">
          <div className="px-5 py-3 flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
            <p className="text-[11px] text-zinc-600 uppercase tracking-wider">Zpětná vazba k reportu</p>
          </div>
          <div className="px-5 pb-5">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Napiš co se ti nelíbí nebo co chceš změnit… (Enter = odeslat)"
                  rows={1}
                  className="w-full resize-none bg-zinc-800/60 border border-zinc-700 hover:border-zinc-600 focus:border-blue-500/50 focus:outline-none rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors leading-relaxed"
                />
              </div>
              <button
                onClick={refine}
                disabled={!feedback.trim() || loading !== 'idle'}
                className="shrink-0 p-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-all"
                title="Odeslat (Enter)"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}
            <p className="mt-2 text-[11px] text-zinc-700">
              Např. „Vlož více detailů k tréninku" · „Zkrať to" · „Přidej motivační závěr"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
