import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const invites = await prisma.invite.findMany({
      where: { createdBy: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(invites.map(i => ({
      ...i,
      isValid: !i.usedAt && i.expiresAt > new Date(),
      inviteUrl: `/invite/${i.code}`,
    })));
  } catch (err) {
    console.error('[api/invites] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const activeCount = await prisma.invite.count({
      where: {
        createdBy: session.user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeCount >= 10) {
      return NextResponse.json({ error: 'Příliš mnoho aktivních pozvánek (max 10)' }, { status: 400 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await prisma.invite.create({
      data: {
        createdBy: session.user.id,
        expiresAt,
      },
    });

    return NextResponse.json({
      ...invite,
      isValid: true,
      inviteUrl: `/invite/${invite.code}`,
    }, { status: 201 });
  } catch (err) {
    console.error('[api/invites] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
