import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const activity = await prisma.activity.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!activity) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(activity);
}
