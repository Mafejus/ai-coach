'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonday, addDays } from '@ai-coach/shared';

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  category: string | null;
  location: string | null;
}

const CATEGORY_STYLES: Record<string, string> = {
  school: 'bg-blue-500/30 border-l-2 border-blue-500 text-blue-200',
  work: 'bg-orange-500/30 border-l-2 border-orange-500 text-orange-200',
  sport: 'bg-green-500/30 border-l-2 border-green-500 text-green-200',
  personal: 'bg-zinc-700/60 border-l-2 border-zinc-500 text-zinc-300',
};

const DAY_NAMES = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const from = weekStart.toISOString().split('T')[0];
    const to = addDays(weekStart, 7).toISOString().split('T')[0];
    fetch(`/api/calendar/events?from=${from}&to=${to}`)
      .then(r => r.json() as Promise<CalendarEvent[]>)
      .then(d => { setEvents(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getEventsForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => e.startTime.split('T')[0] === dateStr);
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Kalendář</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(d => addDays(d, -7))} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors text-zinc-400 hover:text-zinc-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-zinc-300 min-w-[140px] text-center">
            {weekStart.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} – {addDays(weekStart, 6).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors text-zinc-400 hover:text-zinc-100">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setWeekStart(getMonday(new Date()))} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 transition-colors">
            Dnes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-64 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {days.map((day, i) => {
            const isToday = day.getTime() === today.getTime();
            const dayEvents = getEventsForDay(day);
            return (
              <div key={i} className={`bg-zinc-900 rounded-xl border p-3 min-h-[160px] ${isToday ? 'border-blue-500/50' : 'border-zinc-800'}`}>
                <div className="mb-2">
                  <p className={`text-xs font-medium ${isToday ? 'text-blue-400' : 'text-zinc-400'}`}>{DAY_NAMES[i]}</p>
                  <p className={`text-lg font-bold ${isToday ? 'text-blue-300' : 'text-zinc-200'}`}>{day.getDate()}</p>
                </div>
                <div className="space-y-1">
                  {dayEvents.length === 0 ? (
                    <p className="text-xs text-zinc-700 italic">—</p>
                  ) : (
                    dayEvents.map(e => (
                      <div key={e.id} className={`text-xs p-1.5 rounded-md ${CATEGORY_STYLES[e.category ?? 'personal'] ?? CATEGORY_STYLES.personal}`}>
                        <p className="font-medium truncate">{e.title}</p>
                        {!e.isAllDay && (
                          <p className="opacity-70 mt-0.5">{formatTime(e.startTime)}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
        {[['school', 'text-blue-400', 'Škola'], ['work', 'text-orange-400', 'Práce'], ['sport', 'text-green-400', 'Sport'], ['personal', 'text-zinc-400', 'Osobní']].map(([key, color, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${color === 'text-blue-400' ? 'bg-blue-500' : color === 'text-orange-400' ? 'bg-orange-500' : color === 'text-green-400' ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
