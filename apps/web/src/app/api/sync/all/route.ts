import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = new URL(req.url).origin;
  const headers = { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' };

  const [garmin, strava, calendar] = await Promise.allSettled([
    fetch(`${base}/api/sync/garmin`, { method: 'POST', headers }),
    fetch(`${base}/api/sync/strava`, { method: 'POST', headers }),
    fetch(`${base}/api/sync/calendar`, { method: 'POST', headers }),
  ]);

  return NextResponse.json({
    garmin: garmin.status === 'fulfilled' ? await garmin.value.json() : { error: 'failed' },
    strava: strava.status === 'fulfilled' ? await strava.value.json() : { error: 'failed' },
    calendar: calendar.status === 'fulfilled' ? await calendar.value.json() : { error: 'failed' },
    timestamp: new Date().toISOString(),
  });
}
