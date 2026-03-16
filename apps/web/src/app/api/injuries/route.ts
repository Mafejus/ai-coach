import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import type { InjurySeverity } from '@ai-coach/db';
import { z } from 'zod';

const InjurySchema = z.object({
  bodyPart: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
});

async function generateInjuryRestrictions(
  injuryId: string,
  bodyPart: string,
  description: string,
  severity: string,
  userId: string,
) {
  try {
    const { generateObject } = await import('ai');
    const { google } = await import('@ai-sdk/google');
    const { z } = await import('zod');

    const { object } = await generateObject({
      model: google('gemini-2.0-flash'),
      schema: z.object({
        avoidSports: z.array(z.string()),
        avoidMovements: z.array(z.string()),
        alternatives: z.array(z.string()),
        estimatedRecovery: z.string(),
        returnProtocol: z.array(z.string()),
      }),
      prompt: `Sportovní trenér analyzuje zranění:
Místo: ${bodyPart}
Popis: ${description}
Závažnost: ${severity}

Vygeneruj doporučení pro zotavení ve formátu JSON:
- avoidSports: sporty k vynechání (RUN, BIKE, SWIM, STRENGTH, TRIATHLON)
- avoidMovements: pohyby k vynechání (česky)
- alternatives: náhradní aktivity (česky)
- estimatedRecovery: odhad doby zotavení (česky, např. "1-2 týdny")
- returnProtocol: kroky k návratu (česky, max 4 kroky)`,
    });

    await prisma.injury.update({
      where: { id: injuryId },
      data: { restrictions: object },
    });
  } catch (err) {
    console.error('[injuries] Failed to generate restrictions:', err);
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const injuries = await prisma.injury.findMany({
    where: { userId: session.user.id },
    orderBy: [{ active: 'desc' }, { startDate: 'desc' }],
  });

  return NextResponse.json(injuries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = InjurySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const injury = await prisma.injury.create({
    data: {
      userId: session.user.id,
      bodyPart: parsed.data.bodyPart,
      description: parsed.data.description,
      severity: parsed.data.severity as InjurySeverity,
      startDate: new Date(),
      active: true,
    },
  });

  // Generate AI restrictions asynchronously (don't block response)
  void generateInjuryRestrictions(injury.id, parsed.data.bodyPart, parsed.data.description, parsed.data.severity, session.user.id);

  return NextResponse.json(injury, { status: 201 });
}
