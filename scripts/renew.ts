import fs from 'node:fs';
import path from 'node:path';

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

async function main() {
  loadDotEnv();

  const base = trimSlash(process.env.RENEW_BASE_URL || process.env.BASE_URL || 'http://localhost:3000');
  const token = process.env.CRON_SECRET || process.env.APP_PASSWORD;

  if (!token) {
    throw new Error('CRON_SECRET or APP_PASSWORD is required.');
  }

  const response = await fetch(`${base}/api/subscriptions/renew-all`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Renew job failed (${response.status}): ${text}`);
  }

  console.log(`[renew:once] ${text}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});


