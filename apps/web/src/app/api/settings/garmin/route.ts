import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { encrypt } from '@/lib/encryption';
import { z } from 'zod';

const GarminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = GarminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const encryptedPassword = encrypt(parsed.data.password);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      garminEmail: parsed.data.email,
      garminPassword: encryptedPassword,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { garminEmail: null, garminPassword: null },
  });

  return NextResponse.json({ success: true });
}
