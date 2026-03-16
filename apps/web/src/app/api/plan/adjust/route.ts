import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getMonday } from '@ai-coach/shared';
import type { Prisma } from '@ai-coach/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { reason?: string; weekStart?: string };
  const reason = body.reason ?? 'Manual adjustment request';

  const monday = body.weekStart ? new Date(body.weekStart) : getMonday(new Date());

  const plan = await prisma.trainingPlan.findUnique({
    where: { userId_weekStart: { userId: session.user.id, weekStart: monday } },
  });

  if (!plan) return NextResponse.json({ error: 'No plan found for this week' }, { status: 404 });

  // Gather context
  const [health, injuries] = await Promise.all([
    prisma.healthMetric.findFirst({
      where: { userId: session.user.id },
      orderBy: { date: 'desc' },
    }),
    prisma.injury.findMany({
      where: { userId: session.user.id, active: true },
    }),
  ]);

  const healthContext = health ? `
Poslední zdravotní metriky:
- Spánek: ${health.sleepScore ?? '?'}/100
- HRV: ${health.hrvStatus ?? '?'}ms
- Body Battery: ${health.bodyBattery ?? '?'}/100
- Training Readiness: ${health.trainingReadiness ?? '?'}/100
- Stress: ${health.stressScore ?? '?'}/100` : '';

  const injuryContext = injuries.length > 0
    ? `Aktivní zranění: ${injuries.map(i => `${i.bodyPart} (${i.severity})`).join(', ')}`
    : '';

  const { text } = await generateText({
    model: google('gemini-2.0-flash'),
    prompt: `Jsi AI trenér. Uprav níže uvedený tréninkový plán.

Důvod úpravy: ${reason}
${healthContext}
${injuryContext}

Aktuální plán (JSON):
${JSON.stringify(plan.plan, null, 2)}

Uprav plán podle důvodu a zdravotního stavu. Vrať POUZE validní JSON se stejnou strukturou jako vstupní plán. Žádný markdown, žádný komentář.`,
  });

  // Parse adjusted plan
  let adjustedPlan: unknown;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    adjustedPlan = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: 'AI failed to generate valid plan' }, { status: 500 });
  }

  // Save adjustment history
  const existingAdjustments = (plan.adjustments as unknown[]) ?? [];
  const newAdjustment = {
    date: new Date().toISOString(),
    reason,
    aiGenerated: true,
  };

  const updated = await prisma.trainingPlan.update({
    where: { id: plan.id },
    data: {
      plan: adjustedPlan as Prisma.InputJsonValue,
      status: 'ADJUSTED',
      adjustments: [...existingAdjustments, newAdjustment] as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ success: true, plan: updated });
}
