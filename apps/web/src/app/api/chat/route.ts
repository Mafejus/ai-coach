import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { NextRequest } from 'next/server';

// @ai-sdk/google reads GOOGLE_GENERATIVE_AI_API_KEY by default — we use GOOGLE_AI_API_KEY
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { buildSystemPrompt, createCoachTools } from '@ai-coach/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const userId = session.user.id;
  const { messages, conversationId } = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    conversationId?: string;
  };

  // Load user profile and context
  const [user, events, injuries, latestHealth, recentActivities] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.event.findMany({
      where: { userId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 5,
    }),
    prisma.injury.findMany({ where: { userId, active: true } }),
    prisma.healthMetric.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    }),
    prisma.activity.findMany({
      where: { userId, date: { gte: new Date(Date.now() - 7 * 86400000) } },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);

  const systemPrompt = buildSystemPrompt(user, {
    events,
    injuries,
    health: latestHealth ? {
      date: latestHealth.date?.toISOString()?.split('T')[0] ?? '',
      sleepScore: latestHealth.sleepScore,
      sleepDuration: latestHealth.sleepDuration,
      bodyBattery: latestHealth.bodyBattery,
      bodyBatteryChange: latestHealth.bodyBatteryChange,
      hrvStatus: latestHealth.hrvStatus,
      restingHR: latestHealth.restingHR,
      trainingReadiness: latestHealth.trainingReadiness,
    } : null,
    activities: recentActivities.map(a => ({
      date: a.date?.toISOString()?.split('T')[0] ?? '',
      sport: a.sport,
      duration: a.duration,
      distance: a.distance,
      trainingLoad: a.trainingLoad,
      avgHR: a.avgHR,
      avgPace: a.avgPace,
      aerobicTE: (a.rawData as any)?.garminRaw?.aerobicTrainingEffect ?? (a.rawData as any)?.aerobicTrainingEffect,
      anaerobicTE: (a.rawData as any)?.garminRaw?.anaerobicTrainingEffect ?? (a.rawData as any)?.anaerobicTrainingEffect,
      name: a.name,
    })),
  });
  const tools = createCoachTools(userId);

  // Upsert conversation
  let convId = conversationId;
  if (!convId) {
    const conv = await prisma.conversation.create({
      data: { userId, messages: [], tokenCount: 0 },
    });
    convId = conv.id;
  }

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ text, usage }) => {
      if (!convId) return;

      const updatedMessages = [...messages, { role: 'assistant' as const, content: text }];

      // Auto-generate title after 2nd user message
      let title: string | undefined;
      const userMessages = updatedMessages.filter(m => m.role === 'user');
      if (userMessages.length === 2) {
        try {
          const titleResult = await streamText({
            model: google('gemini-2.5-flash'),
            messages: [
              {
                role: 'user',
                content: `Vygeneruj krátký název konverzace (max 5 slov, bez uvozovek) na základě těchto zpráv:\n${userMessages.map(m => m.content).join('\n')}`,
              },
            ],
          });
          title = (await titleResult.text).trim().slice(0, 60);
        } catch {
          // Ignore title generation errors
        }
      }

      await prisma.conversation.update({
        where: { id: convId! },
        data: {
          messages: updatedMessages,
          tokenCount: { increment: usage.totalTokens },
          updatedAt: new Date(),
          ...(title && { title }),
        },
      });
    },
  });

  const response = result.toDataStreamResponse();
  // Include conversationId in header so client can track it
  const headers = new Headers(response.headers);
  headers.set('X-Conversation-Id', convId);
  return new Response(response.body, { status: response.status, headers });
}
