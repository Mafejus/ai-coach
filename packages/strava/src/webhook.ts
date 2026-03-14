import type { StravaWebhookEvent } from './types';

export function verifyWebhookChallenge(
  hubVerifyToken: string,
  expectedToken: string,
  hubChallenge: string,
): { 'hub.challenge': string } | null {
  if (hubVerifyToken !== expectedToken) return null;
  return { 'hub.challenge': hubChallenge };
}

export function parseWebhookEvent(body: unknown): StravaWebhookEvent | null {
  if (!body || typeof body !== 'object') return null;
  const event = body as Record<string, unknown>;
  if (!event.object_type || !event.aspect_type || !event.owner_id) return null;
  return event as unknown as StravaWebhookEvent;
}

export function isActivityEvent(event: StravaWebhookEvent): boolean {
  return event.object_type === 'activity';
}
