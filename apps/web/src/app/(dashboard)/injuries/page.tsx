'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, X, CheckCircle } from 'lucide-react';

interface Injury {
  id: string;
  bodyPart: string;
  description: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  startDate: string;
  endDate: string | null;
  active: boolean;
  restrictions: unknown;
}

const SEVERITY_STYLES: Record<string, string> = {
  MILD: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  MODERATE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  SEVERE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SEVERITY_LABELS: Record<string, string> = { MILD: 'Mírné', MODERATE: 'Střední', SEVERE: 'Vážné' };

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export default function InjuriesPage() {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bodyPart: '', description: '', severity: 'MILD' as 'MILD' | 'MODERATE' | 'SEVERE' });
  const [saving, setSaving] = useState(false);

  const fetchInjuries = () => {
    fetch('/api/injuries')
      .then(r => r.json() as Promise<Injury[]>)
      .then(d => { setInjuries(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchInjuries(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/injuries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ bodyPart: '', description: '', severity: 'MILD' });
    setSaving(false);
    fetchInjuries();
  };

  const markHealed = async (id: string) => {
    await fetch(`/api/injuries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, endDate: new Date().toISOString().split('T')[0] }),
    });
    fetchInjuries();
  };

  const active = injuries.filter(i => i.active);
  const healed = injuries.filter(i => !i.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Zranění</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Přidat zranění
        </button>
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-zinc-100">Nové zranění</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Tělesná část</label>
                <input
                  required
                  placeholder="např. left_achilles, right_knee"
                  value={form.bodyPart}
                  onChange={e => setForm(f => ({ ...f, bodyPart: e.target.value }))}
                  className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Popis</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Popiš zranění, kdy vzniklo, co bolí..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400">Závažnost</label>
                <div className="flex gap-2 mt-1">
                  {(['MILD', 'MODERATE', 'SEVERE'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, severity: s }))}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${form.severity === s ? SEVERITY_STYLES[s] : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                    >
                      {SEVERITY_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Active injuries */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Aktivní ({active.length})</h2>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />)
        ) : active.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-50" />
            <p>Žádná aktivní zranění 💪</p>
          </div>
        ) : active.map(injury => (
          <div key={injury.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0" />
                <div>
                  <p className="font-medium text-zinc-100">{injury.bodyPart.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-zinc-400">Začátek: {new Date(injury.startDate).toLocaleDateString('cs-CZ')} · {daysSince(injury.startDate)} dní</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[injury.severity]}`}>{SEVERITY_LABELS[injury.severity]}</span>
                <button onClick={() => markHealed(injury.id)} className="text-xs text-zinc-400 hover:text-green-400 transition-colors">Vyléčeno</button>
              </div>
            </div>
            <p className="text-sm text-zinc-300">{injury.description}</p>
            {injury.restrictions != null && (
              <div className="text-xs text-zinc-400 bg-zinc-800/50 rounded-lg p-2">
                <pre className="whitespace-pre-wrap">{JSON.stringify(injury.restrictions as Record<string, unknown>, null, 2)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Healed */}
      {healed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Historie ({healed.length})</h2>
          {healed.map(injury => (
            <div key={injury.id} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg opacity-60">
              <div>
                <p className="text-sm text-zinc-300">{injury.bodyPart.replace(/_/g, ' ')}</p>
                <p className="text-xs text-zinc-500">{new Date(injury.startDate).toLocaleDateString('cs-CZ')} – {injury.endDate ? new Date(injury.endDate).toLocaleDateString('cs-CZ') : '?'}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[injury.severity]}`}>{SEVERITY_LABELS[injury.severity]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
