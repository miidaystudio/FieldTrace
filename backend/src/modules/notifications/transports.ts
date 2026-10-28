import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { env, isProduction } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

const SEND_TIMEOUT_MS = 5_000;

// ------------------------------------------------------------------ email

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends one email. With `RESEND_API_KEY` it goes through Resend; otherwise it is only written to
 * the log (development) and reported as `logged`.
 */
export async function sendEmail(message: EmailMessage): Promise<'sent' | 'logged'> {
  if (!env.RESEND_API_KEY) {
    logger.info(
      { to: message.to, subject: message.subject },
      'Email (not sent: no RESEND_API_KEY)',
    );
    return 'logged';
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok)
    throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return 'sent';
}

// ------------------------------------------------------------------ webhooks

/** True for loopback, private, link-local, CGNAT and unique-local addresses. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number) as [number, number];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = address.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80')
  );
}

/**
 * Rejects webhook targets that could reach internal services (SSRF). In production the URL must
 * be HTTPS and must not resolve to a private address; development also allows http and localhost
 * so receivers can be tested locally. Returns an error message, or null when acceptable.
 */
export async function checkWebhookUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'not a valid URL';
  }
  if (url.username || url.password) return 'credentials in the URL are not allowed';
  if (!isProduction)
    return url.protocol === 'https:' || url.protocol === 'http:' ? null : 'must be http(s)';
  if (url.protocol !== 'https:') return 'must use https';
  const host = url.hostname.replace(/^\[|\]$/g, '');
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addresses.length === 0) return 'host does not resolve';
    if (addresses.some((entry) => isPrivateAddress(entry.address)))
      return 'must not point to a private or local network address';
  } catch {
    return 'host does not resolve';
  }
  return null;
}

/** `sha256=<hex>` over `${timestamp}.${body}` — receivers recompute it with the shared secret. */
export function signWebhook(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

export async function postWebhook(
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const problem = await checkWebhookUrl(url);
  if (problem) throw new Error(`Webhook URL rejected: ${problem}`);
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual', // a redirect could point somewhere internal
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FieldTrace-Webhooks/1',
      'X-FieldTrace-Event': event,
      'X-FieldTrace-Timestamp': timestamp,
      'X-FieldTrace-Signature': signWebhook(secret, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Receiver responded ${res.status}`);
  return res.status;
}
