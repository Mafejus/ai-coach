import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

// POST /api/admin/deduplicate
// Scans all activities for the current user and removes duplicates.
// Dedup criteria: same date (±5 min) + similar distance (±10%).
// Keeps the record with more data (prefer GARMIN if it has HR, otherwise whichever has more non-null fields).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activities = await prisma.activity.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'asc' },
    });

    const toDelete = new Set<string>();
    const windowMs = 5 * 60 * 1000; // ±5 minutes

    for (let i = 0; i < activities.length; i++) {
      if (toDelete.has(activities[i]!.id)) continue;
      const a = activities[i]!;

      for (let j = i + 1; j < activities.length; j++) {
        if (toDelete.has(activities[j]!.id)) continue;
        const b = activities[j]!;

        const timeDiff = Math.abs(a.date.getTime() - b.date.getTime());
        if (timeDiff > windowMs) break; // activities are sorted, no more candidates

        // Check distance similarity (±10%)
        if (a.distance != null && b.distance != null) {
          const distRatio = Math.abs(a.distance - b.distance) / Math.max(a.distance, b.distance);
          if (distRatio > 0.1) continue;
        } else if (a.distance !== b.distance) {
          // one has distance, the other doesn't — not a match
          continue;
        }

        // These are duplicates — decide which to keep
        const aScore = scoreActivity(a);
        const bScore = scoreActivity(b);
        const deleteId = aScore >= bScore ? b.id : a.id;
        toDelete.add(deleteId);
        if (deleteId === a.id) break; // a is deleted, move to next i
      }
    }

    if (toDelete.size > 0) {
      await prisma.activity.deleteMany({
        where: { id: { in: Array.from(toDelete) } },
      });
    }

    return NextResponse.json({
      success: true,
      deleted: toDelete.size,
      checked: activities.length,
    });
  } catch (err) {
    console.error('[api/admin/deduplicate] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function scoreActivity(a: { source: string; avgHR: number | null; trainingLoad: number | null; avgPace: number | null; avgPower: number | null; calories: number | null }): number {
  let score = 0;
  if (a.source === 'GARMIN') score += 2;
  if (a.avgHR != null) score += 2;
  if (a.trainingLoad != null) score += 2;
  if (a.avgPace != null) score += 1;
  if (a.avgPower != null) score += 1;
  if (a.calories != null) score += 1;
  return score;
}
