import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      tokenCount: true,
      createdAt: true,
      updatedAt: true,
      messages: true,
    },
  });

  // Return with message count for preview
  return NextResponse.json(
    conversations.map(c => ({
      ...c,
      messageCount: Array.isArray(c.messages) ? (c.messages as unknown[]).length : 0,
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { title?: string };

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.user.id,
      title: body.title ?? null,
      messages: [],
      tokenCount: 0,
    },
  });

  return NextResponse.json(conversation, { status: 201 });
}
