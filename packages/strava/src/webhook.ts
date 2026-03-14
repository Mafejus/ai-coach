import type { StravaWebhookEvent } from './types';

export function verifyWebhookChallenge(
  token: string,
  expectedToken: string,
  challenge: string,
): { 'hub.challenge': string } | null {
  if (token !== expectedToken) return null;
  return { 'hub.challenge': challenge };
}

export function parseWebhookEvent(body: unknown): StravaWebhookEvent | null {
  // TODO: Validate and parse webhook event
  return body as StravaWebhookEvent;
}
