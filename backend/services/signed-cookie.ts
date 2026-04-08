import crypto from 'node:crypto';
import { env } from '@/backend/config/env';

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

export function toSignedValue(value: string) {
  return `${value}.${signValue(value)}`;
}

export function fromSignedValue(raw: string | undefined) {
  if (!raw) return null;
  const idx = raw.lastIndexOf('.');
  if (idx < 0) return null;

  const value = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);

  return timingSafeEqual(sig, signValue(value)) ? value : null;
}

