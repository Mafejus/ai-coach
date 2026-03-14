import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';
import { GarminClient } from '@ai-coach/garmin';
import { decrypt } from '@/lib/encryption';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { garminEmail: true, garminPassword: true },
  });

  if (!user.garminEmail || !user.garminPassword) {
    return NextResponse.json({ error: 'Garmin credentials not saved' }, { status: 400 });
  }

  try {
    const password = decrypt(user.garminPassword);
    const client = new GarminClient(user.garminEmail, password);
    await client.authenticate();
    return NextResponse.json({ success: true, message: 'Garmin připojení funguje' });
  } catch (err) {
    console.error('[garmin/test] Auth error:', err);
    return NextResponse.json({ success: false, error: 'Přihlášení selhalo — zkontroluj email a heslo' }, { status: 400 });
  }
}
