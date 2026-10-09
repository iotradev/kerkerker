import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSigningSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAdminSessionToken(now = Date.now()): string {
  const secret = getSigningSecret();
  if (!secret) throw new Error('ADMIN_PASSWORD must be configured before creating an admin session');
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expiresAt}.${randomBytes(32).toString('base64url')}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function validateAdminSessionToken(token: string | undefined, now = Date.now()): boolean {
  const secret = getSigningSecret();
  if (!secret || !token) return false;
  const match = /^v1\.(\d{10})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Number(match[1]) <= Math.floor(now / 1000)) return false;

  const payload = `${match[0].split('.').slice(0, 3).join('.')}`;
  const expected = Buffer.from(signature(payload, secret));
  const actual = Buffer.from(match[3]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
