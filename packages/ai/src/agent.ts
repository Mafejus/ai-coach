import { streamText, generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { prisma } from '@ai-coach/db';
import { buildSystemPrompt } from './prompts/system';
import { createCoachTools } from './tools';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentOptions {
  userId: string;
  messages: Message[];
  conversationId?: string;
  stream?: boolean;
}

export async function runCoachAgent({ userId, messages, conversationId, stream = true }: AgentOptions) {
  // Load user profile and context
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const [events, injuries] = await Promise.all([
    prisma.event.findMany({
      where: { userId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 5,
    }),
    prisma.injury.findMany({
      where: { userId, active: true },
    }),
  ]);

  const systemPrompt = buildSystemPrompt(user, { events, injuries });
  const tools = createCoachTools(userId);

  if (stream) {
    return streamText({
      model: google('gemini-2.5-pro'),
      system: systemPrompt,
      messages,
      tools,
      maxSteps: 5,
      onFinish: async ({ text, usage }) => {
        if (conversationId) {
          await prisma.conversation.update({
            where: { id: conversationId },
            data: {
              messages: [...messages, { role: 'assistant', content: text }],
              tokenCount: { increment: usage.totalTokens },
              updatedAt: new Date(),
            },
          });
        }
      },
    });
  }

  return generateText({
    model: google('gemini-2.5-pro'),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 5,
  });
}
