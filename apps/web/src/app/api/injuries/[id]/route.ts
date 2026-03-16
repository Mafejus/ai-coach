import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { active?: boolean; endDate?: string };

  const injury = await prisma.injury.update({
    where: { id, userId: session.user.id },
    data: {
      ...(typeof body.active === 'boolean' && { active: body.active }),
      ...(body.endDate && { endDate: new Date(body.endDate) }),
    },
  });

  return NextResponse.json(injury);
}
