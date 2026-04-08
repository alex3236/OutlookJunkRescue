import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from '@/backend/config/env';

const SESSION_COOKIE = 'rescue_session';

function signValue(value: string) {
  return crypto.createHmac('sha256', env.sessionSecret).update(value).digest('hex');
}

function timingSafeEqual(a: string, b: string) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function createPasswordToken(password: string) {
  return `${password}.${signValue(password)}`;
}

export function validatePasswordToken(raw: string | null | undefined) {
  if (!raw || typeof raw !== 'string') return false;
  const idx = raw.lastIndexOf('.');
  if (idx < 0) return false;
  const value = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  return value === env.appPassword && timingSafeEqual(sig, signValue(value));
}

export async function isSessionAuthorized() {
  const cookieStore = await cookies();
  return validatePasswordToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

