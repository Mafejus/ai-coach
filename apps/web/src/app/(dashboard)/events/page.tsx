'use client';

import { useEffect, useState } from 'react';
import { Trophy, Plus, Pencil, Trash2, X, Check } from 'lucide-react';

interface EventItem {
  id: string;
  name: string;
  sport: string;
  priority: string;
  date: string;
  distance: number | null;
  swimDist: number | null;
  bikeDist: number | null;
  runDist: number | null;
  targetTime: number | null;
  notes: string | null;
  daysUntil: number;
}

interface EventForm {
  name: string;
  sport: string;
  priority: string;
  date: string;
  distance: string;
  swimDist: string;
  bikeDist: string;
  runDist: string;
  targetTime: string; // "HH:MM:SS"
  notes: string;
}

const emptyForm: EventForm = {
  name: '',
  sport: 'RUN',
  priority: 'MAIN',
  date: '',
  distance: '',
  swimDist: '',
  bikeDist: '',
  runDist: '',
  targetTime: '',
  notes: '',
};

const SPORT_ICONS: Record<string, string> = {
  RUN: '🏃',
  BIKE: '🚴',
  SWIM: '🏊',
  TRIATHLON: '🏅',
  STRENGTH: '🏋️',
  OTHER: '⚡',
};

const SPORT_LABELS: Record<string, string> = {
  RUN: 'Běh',
  BIKE: 'Cyklistika',
  SWIM: 'Plavání',
  TRIATHLON: 'Triatlon',
  STRENGTH: 'Síla',
  OTHER: 'Jiné',
};

const PRIORITY_STYLES: Record<string, string> = {
  MAIN: 'border-yellow-500/60 text-yellow-400 bg-yellow-500/10',
  SECONDARY: 'border-blue-500/60 text-blue-400 bg-blue-500/10',
  TRAINING: 'border-zinc-600 text-zinc-400 bg-zinc-800/50',
};

const PRIORITY_LABELS: Record<string, string> = {
  MAIN: 'Hlavní',
  SECONDARY: 'Vedlejší',
  TRAINING: 'Tréninkový',
};

function secondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timeToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60;
  }
  return 0;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
      setError('Nepodařilo se načíst závody.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(event: EventItem) {
    setEditingId(event.id);
    setForm({
      name: event.name,
      sport: event.sport,
      priority: event.priority,
      date: event.date.split('T')[0] ?? '',
      distance: event.distance != null ? String(event.distance) : '',
      swimDist: event.swimDist != null ? String(event.swimDist) : '',
      bikeDist: event.bikeDist != null ? String(event.bikeDist) : '',
      runDist: event.runDist != null ? String(event.runDist) : '',
      targetTime: event.targetTime != null ? secondsToTime(event.targetTime) : '',
      notes: event.notes ?? '',
    });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function updateField<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      sport: form.sport,
      priority: form.priority,
      date: form.date,
    };

    if (form.sport === 'TRIATHLON') {
      if (form.swimDist) payload.swimDist = parseFloat(form.swimDist);
      if (form.bikeDist) payload.bikeDist = parseFloat(form.bikeDist);
      if (form.runDist) payload.runDist = parseFloat(form.runDist);
    } else {
      if (form.distance) payload.distance = parseFloat(form.distance);
    }

    if (form.targetTime) payload.targetTime = timeToSeconds(form.targetTime);
    if (form.notes) payload.notes = form.notes;

    try {
      const url = editingId ? `/api/events/${editingId}` : '/api/events';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Chyba při ukládání.');
        return;
      }

      closeForm();
      await loadEvents();
    } catch {
      setError('Síťová chyba.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== id));
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const upcoming = events.filter(e => e.daysUntil >= 0);
  const past = events.filter(e => e.daysUntil < 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Závody</h1>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Přidat závod
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-100">
              {editingId ? 'Upravit závod' : 'Nový závod'}
            </h2>
            <button onClick={closeForm} className="text-zinc-400 hover:text-zinc-200 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Název závodu *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="např. Pražský maraton 2025"
              />
            </div>

            {/* Sport + Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Sport *</label>
                <select
                  value={form.sport}
                  onChange={e => updateField('sport', e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                >
                  {Object.entries(SPORT_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{SPORT_ICONS[val]} {label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Priorita *</label>
                <div className="flex gap-2 pt-1">
                  {(['MAIN', 'SECONDARY', 'TRAINING'] as const).map(p => (
                    <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value={p}
                        checked={form.priority === p}
                        onChange={() => updateField('priority', p)}
                        className="accent-blue-500"
                      />
                      <span className="text-xs text-zinc-300">{PRIORITY_LABELS[p]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Datum závodu *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={e => updateField('date', e.target.value)}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Distance fields */}
            {form.sport === 'TRIATHLON' ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Plavání (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.swimDist}
                    onChange={e => updateField('swimDist', e.target.value)}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                    placeholder="3.8"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Kolo (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.bikeDist}
                    onChange={e => updateField('bikeDist', e.target.value)}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                    placeholder="180"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Běh (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.runDist}
                    onChange={e => updateField('runDist', e.target.value)}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                    placeholder="42.2"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Vzdálenost (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.distance}
                  onChange={e => updateField('distance', e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                  placeholder="42.195"
                />
              </div>
            )}

            {/* Target time */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Cílový čas (H:MM:SS)</label>
              <input
                type="text"
                value={form.targetTime}
                onChange={e => updateField('targetTime', e.target.value)}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="3:30:00"
                pattern="\d+:\d{2}:\d{2}"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Poznámky</label>
              <textarea
                value={form.notes}
                onChange={e => updateField('notes', e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Volitelné poznámky..."
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Ukládám...' : editingId ? 'Uložit změny' : 'Přidat závod'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
              >
                Zrušit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && !showForm && (
        <div className="text-center py-16 text-zinc-500">
          <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-zinc-400">Žádné závody.</p>
          <p className="text-sm mt-1">Přidejte svůj první závod a začněte plánovat přípravu.</p>
          <button
            onClick={openAdd}
            className="mt-4 flex items-center gap-2 mx-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Přidat závod
          </button>
        </div>
      )}

      {/* Upcoming events */}
      {!loading && upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Nadcházející závody</h2>
          {upcoming.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={openEdit}
              onDeleteRequest={setConfirmDeleteId}
              confirmDeleteId={confirmDeleteId}
              onDeleteConfirm={handleDelete}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              deletingId={deletingId}
              isPast={false}
            />
          ))}
        </div>
      )}

      {/* Past events */}
      {!loading && past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">Minulé závody</h2>
          {past.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={openEdit}
              onDeleteRequest={setConfirmDeleteId}
              confirmDeleteId={confirmDeleteId}
              onDeleteConfirm={handleDelete}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              deletingId={deletingId}
              isPast={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EventCardProps {
  event: EventItem;
  onEdit: (e: EventItem) => void;
  onDeleteRequest: (id: string) => void;
  confirmDeleteId: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
  deletingId: string | null;
  isPast: boolean;
}

function EventCard({
  event,
  onEdit,
  onDeleteRequest,
  confirmDeleteId,
  onDeleteConfirm,
  onDeleteCancel,
  deletingId,
  isPast,
}: EventCardProps) {
  const isConfirming = confirmDeleteId === event.id;
  const isDeleting = deletingId === event.id;

  function distanceLabel(): string | null {
    if (event.sport === 'TRIATHLON') {
      const parts = [];
      if (event.swimDist) parts.push(`🏊 ${event.swimDist}km`);
      if (event.bikeDist) parts.push(`🚴 ${event.bikeDist}km`);
      if (event.runDist) parts.push(`🏃 ${event.runDist}km`);
      return parts.length > 0 ? parts.join(' · ') : null;
    }
    return event.distance ? `${event.distance}km` : null;
  }

  const dist = distanceLabel();

  return (
    <div
      className={`bg-zinc-900 border rounded-xl p-4 transition-opacity ${
        isPast ? 'border-zinc-800 opacity-60' : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl shrink-0 mt-0.5">{SPORT_ICONS[event.sport] ?? '⚡'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-zinc-100 truncate">{event.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[event.priority] ?? PRIORITY_STYLES.TRAINING}`}>
                {PRIORITY_LABELS[event.priority] ?? event.priority}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {formatDate(event.date)}
              {dist && <span> · {dist}</span>}
              {event.targetTime && <span> · Cíl: {secondsToTime(event.targetTime)}</span>}
            </p>
            {event.notes && <p className="text-xs text-zinc-500 mt-1 italic truncate">{event.notes}</p>}
          </div>
        </div>

        {/* Countdown / Past badge */}
        <div className="shrink-0 text-right">
          {isPast ? (
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-1 rounded-full">Proběhl</span>
          ) : event.daysUntil === 0 ? (
            <div>
              <p className="text-lg font-bold text-yellow-400">Dnes!</p>
            </div>
          ) : (
            <div>
              <p className="text-xl font-bold text-blue-400">{event.daysUntil}</p>
              <p className="text-xs text-zinc-400">dní</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
        {isConfirming ? (
          <>
            <span className="text-xs text-zinc-400 mr-auto">Opravdu smazat?</span>
            <button
              onClick={() => onDeleteConfirm(event.id)}
              disabled={isDeleting}
              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? 'Mažu...' : 'Smazat'}
            </button>
            <button
              onClick={onDeleteCancel}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Zrušit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEdit(event)}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Upravit
            </button>
            <button
              onClick={() => onDeleteRequest(event.id)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors ml-auto"
            >
              <Trash2 className="h-3 w-3" />
              Smazat
            </button>
          </>
        )}
      </div>
    </div>
  );
}
