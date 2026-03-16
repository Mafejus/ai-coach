import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, Prisma } from '@ai-coach/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subscription = await req.json() as Record<string, unknown>;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pushSubscription: subscription as Prisma.InputJsonValue },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pushSubscription: Prisma.JsonNull },
  });

  return NextResponse.json({ success: true });
}
