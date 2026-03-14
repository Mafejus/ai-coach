import type { CalendarEventData, EventCategory } from './types';

// Keywords for AI-free classification of event categories
const SCHOOL_KEYWORDS = ['přednáška', 'cvičení', 'zkouška', 'seminář', 'škola', 'výuka', 'fakulta'];
const WORK_KEYWORDS = ['meeting', 'porada', 'práce', 'schůzka', 'projekt'];
const SPORT_KEYWORDS = ['trénink', 'závod', 'race', 'run', 'swim', 'bike', 'triathlon'];

export function classifyEventCategory(title: string, description?: string): EventCategory {
  const text = `${title} ${description ?? ''}`.toLowerCase();

  if (SPORT_KEYWORDS.some((kw) => text.includes(kw))) return 'sport';
  if (SCHOOL_KEYWORDS.some((kw) => text.includes(kw))) return 'school';
  if (WORK_KEYWORDS.some((kw) => text.includes(kw))) return 'work';
  return 'personal';
}

export function parseGoogleEvent(
  event: {
    id?: string | null;
    summary?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    end?: { dateTime?: string | null; date?: string | null } | null;
    location?: string | null;
    description?: string | null;
  },
  source: string,
  calendarId: string,
): CalendarEventData | null {
  if (!event.id || !event.summary || !event.start || !event.end) return null;

  const isAllDay = !event.start.dateTime;
  const startTime = new Date(event.start.dateTime ?? event.start.date ?? '');
  const endTime = new Date(event.end.dateTime ?? event.end.date ?? '');

  return {
    externalId: event.id,
    title: event.summary,
    startTime,
    endTime,
    isAllDay,
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    calendarId,
    source,
  };
}
