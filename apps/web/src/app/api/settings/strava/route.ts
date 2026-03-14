import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, Prisma } from '@ai-coach/db';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { stravaTokens: Prisma.JsonNull },
  });

  return NextResponse.json({ success: true });
}
