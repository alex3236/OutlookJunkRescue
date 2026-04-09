import fs from 'node:fs';
import path from 'node:path';

type HeadersMap = Record<string, string>;

function loadDotEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function trimSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function parseSetCookie(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0];
  const pair = first.split(';')[0]?.trim();
  return pair || null;
}

async function requestJson(url: string, init?: RequestInit, extraHeaders: HeadersMap = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
      ...extraHeaders,
    },
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Keep raw text when response is not JSON.
  }

  return {response, data};
}

async function main() {
  loadDotEnv();

  const base = trimSlash(process.env.SMOKE_BASE_URL || process.env.BASE_URL || 'http://localhost:3000');
  const password = process.env.APP_PASSWORD;

  if (!password) {
    throw new Error('APP_PASSWORD is required for smoke test.');
  }

  console.log(`[smoke] Base URL: ${base}`);

  const health = await fetch(`${base}/api/health`);
  if (!health.ok) {
    throw new Error(`[smoke] GET /api/health failed with status ${health.status}`);
  }
  console.log('[smoke] GET /api/health OK');

  const login = await requestJson(
    `${base}/api/auth/login`,
    {
      method: 'POST',
      body: JSON.stringify({password}),
    },
  );

  if (!login.response.ok) {
    throw new Error(`[smoke] POST /api/auth/login failed: ${JSON.stringify(login.data)}`);
  }

  const sessionCookie = parseSetCookie(login.response.headers.get('set-cookie'));
  if (!sessionCookie) {
    throw new Error('[smoke] Login succeeded but no session cookie was returned.');
  }
  console.log('[smoke] POST /api/auth/login OK');

  const status = await requestJson(`${base}/api/status`, undefined, {Cookie: sessionCookie});
  if (!status.response.ok) {
    throw new Error(`[smoke] GET /api/status failed: ${JSON.stringify(status.data)}`);
  }
  console.log('[smoke] GET /api/status OK');

  const statusWithBearer = await requestJson(`${base}/api/status`, undefined, {Authorization: `Bearer ${password}`});
  if (!statusWithBearer.response.ok) {
    throw new Error(`[smoke] GET /api/status with bearer token failed: ${JSON.stringify(statusWithBearer.data)}`);
  }
  console.log('[smoke] GET /api/status with bearer token OK');

  const logs = await requestJson(`${base}/api/logs`, undefined, {Cookie: sessionCookie});
  if (!logs.response.ok) {
    throw new Error(`[smoke] GET /api/logs failed: ${JSON.stringify(logs.data)}`);
  }
  console.log('[smoke] GET /api/logs OK');

  console.log('[smoke] All checks passed.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});


