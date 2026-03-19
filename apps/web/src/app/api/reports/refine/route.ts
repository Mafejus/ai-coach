import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { feedback } = await req.json() as { feedback: string };
  if (!feedback?.trim()) return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });

  const userId = session.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.dailyReport.findFirst({
    where: { userId, date: { gte: today } },
    select: { id: true, markdown: true },
  });

  if (!existing?.markdown) {
    return NextResponse.json({ error: 'No report found for today' }, { status: 404 });
  }

  const prompt = `Tady je původní ranní tréninkový briefing:

---
${existing.markdown}
---

Uživatel k němu říká:
"${feedback}"

Uprav a přepiš briefing na základě zpětné vazby uživatele. Zachovej stejnou strukturu, jazyk (čeština) a styl jako originál. Zohledni komentář uživatele a oprav nebo doplň, co žádá. Vrať pouze upravený briefing bez dalšího komentáře.`;

  const { text } = await generateText({
    model: google('gemini-2.5-pro'),
    prompt,
  });

  const updated = await prisma.dailyReport.update({
    where: { id: existing.id },
    data: { markdown: text },
  });

  return NextResponse.json({ markdown: updated.markdown });
}
