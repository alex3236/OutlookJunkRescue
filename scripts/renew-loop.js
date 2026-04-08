const intervalSeconds = Number(process.env.RENEW_INTERVAL_SECONDS || 600);
const baseUrl = (process.env.RENEW_BASE_URL || process.env.APP_INTERNAL_URL || 'http://app:3000').replace(/\/$/, '');
const token = process.env.CRON_SECRET || process.env.APP_PASSWORD;

if (!token) {
  console.error('[renew-loop] CRON_SECRET or APP_PASSWORD is required.');
  process.exit(1);
}

if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
  console.error('[renew-loop] RENEW_INTERVAL_SECONDS must be a positive number.');
  process.exit(1);
}

async function runOnce() {
  const response = await fetch(`${baseUrl}/api/subscriptions/renew-all`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  console.log(`[renew-loop] renew success: ${body}`);
}

async function runTick() {
  const startedAt = new Date().toISOString();
  try {
    await runOnce();
    console.log(`[renew-loop] run finished at ${startedAt}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[renew-loop] run failed at ${startedAt}: ${message}`);
  }
}

function scheduleNextTick() {
  setTimeout(() => {
    void runTick().finally(() => {
      scheduleNextTick();
    });
  }, intervalSeconds * 1000);
}

async function main() {
  console.log(`[renew-loop] starting; target=${baseUrl}; interval=${intervalSeconds}s`);
  await runTick();
  scheduleNextTick();
  await new Promise(() => {});
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[renew-loop] fatal: ${message}`);
  process.exit(1);
});


