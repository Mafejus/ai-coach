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
  // For all-day events, Google returns a date string "YYYY-MM-DD" without time.
  // Using new Date("YYYY-MM-DD") parses as UTC midnight, causing a timezone offset shift.
  // Appending T00:00:00 makes it parse as local time instead.
  // For all-day events, Google returns "YYYY-MM-DD". Store as UTC midnight of that date
  // so the date is stable regardless of server timezone.
  const startTime = event.start.dateTime
    ? new Date(event.start.dateTime)
    : new Date((event.start.date ?? '') + 'T00:00:00Z');
  const endTime = event.end.dateTime
    ? new Date(event.end.dateTime)
    : new Date((event.end.date ?? '') + 'T00:00:00Z');

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
