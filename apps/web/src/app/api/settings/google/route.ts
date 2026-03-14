import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, Prisma } from '@ai-coach/db';

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const account = req.nextUrl.searchParams.get('account') ?? 'primary';

  await prisma.user.update({
    where: { id: session.user.id },
    data: account === 'school' ? { googleTokens2: Prisma.JsonNull } : { googleTokens: Prisma.JsonNull },
  });

  return NextResponse.json({ success: true });
}
