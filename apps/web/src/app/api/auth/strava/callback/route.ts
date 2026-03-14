import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@ai-coach/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }

  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?error=strava_denied', req.nextUrl.origin));
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Strava code for tokens');
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
      athlete: { id: number };
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        stravaTokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: data.expires_at * 1000,
          athleteId: data.athlete.id,
        },
      },
    });

    return NextResponse.redirect(new URL('/settings?success=strava_connected', req.nextUrl.origin));
  } catch (err) {
    console.error('Strava OAuth callback error:', err);
    return NextResponse.redirect(new URL('/settings?error=strava_failed', req.nextUrl.origin));
  }
}
