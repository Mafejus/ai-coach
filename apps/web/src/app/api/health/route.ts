import { NextResponse } from 'next/server';
import { prisma } from '@ai-coach/db';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; detail?: string }> = {};

  // DB check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.db = { status: 'error', latencyMs: Date.now() - dbStart, detail: String(err) };
  }

  const allOk = Object.values(checks).every(c => c.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    services: checks,
  }, { status: allOk ? 200 : 503 });
}
