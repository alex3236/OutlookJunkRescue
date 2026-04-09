import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {env} from '@/backend/config/env';
import {nowIso} from '@/backend/utils/time';
import type {GraphWebhookCertificateState, LogLevel, StoreSchema} from '@/backend/types/store';

const MAX_LAST_NOTIFICATIONS = 50;
let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

function sanitizeJson(value: unknown) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return {note: 'unserializable_extra'};
  }
}

function getSender(extra: unknown) {
  if (!extra || typeof extra !== 'object') return null;
  const value = extra as Record<string, unknown>;
  if (typeof value.sender === 'string' && value.sender.trim()) return value.sender;
  const from = value.from;
  if (!from || typeof from !== 'object') return null;
  const fromValue = from as Record<string, unknown>;
  const emailAddress = fromValue.emailAddress;
  if (!emailAddress || typeof emailAddress !== 'object') return null;
  const email = emailAddress as Record<string, unknown>;
  if (typeof email.name === 'string' && email.name.trim()) return email.name;
  if (typeof email.address === 'string' && email.address.trim()) return email.address;
  return null;
}

function minimalNonErrorExtra(message: string, extra: unknown) {
  if (!extra || typeof extra !== 'object') return null;
  const value = extra as Record<string, unknown>;
  const sender = getSender(extra);
  const subject = typeof value.subject === 'string' && value.subject.trim() ? value.subject : null;
  if (!message.includes('Moved message from Junk to Inbox') && !sender && !subject) return null;

  const minimal: Record<string, unknown> = {};
  if (sender) minimal.sender = sender;
  if (subject) minimal.subject = subject;
  return Object.keys(minimal).length > 0 ? minimal : null;
}

function toDbExtra(level: LogLevel, message: string, extra: unknown) {
  if (level === 'error' || level === 'warn') return sanitizeJson(extra);
  return minimalNonErrorExtra(message, extra);
}

function getPool() {
  if (pool) return pool;
  const ssl = /neon\.tech/i.test(env.databaseUrl) || /sslmode=require/i.test(env.databaseUrl)
    ? {rejectUnauthorized: false}
    : undefined;
  pool = new Pool({connectionString: env.databaseUrl, ssl});
  return pool;
}

async function upsertKvJson(key: string, value: unknown) {
  await getPool().query(
    `
        INSERT INTO app_kv (key, value, updated_at)
        VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (key)
      DO
        UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [key, JSON.stringify(sanitizeJson(value))],
  );
}

async function getKvJson<T>(key: string, fallback: T): Promise<T> {
  const {rows} = await getPool().query<{ value: T }>(`SELECT value
                                                      FROM app_kv
                                                      WHERE key = $1`, [key]);
  if (!rows[0]) return fallback;
  return rows[0].value;
}

async function ensureReady() {
  if (!initPromise) {
    initPromise = (async () => {
      await getPool().query(`
          CREATE TABLE IF NOT EXISTS app_kv
          (
              key
              TEXT
              PRIMARY
              KEY,
              value
              JSONB
              NOT
              NULL,
              updated_at
              TIMESTAMPTZ
              NOT
              NULL
              DEFAULT
              NOW
          (
          )
              )
      `);

      await getPool().query(`
          CREATE TABLE IF NOT EXISTS activity_logs
          (
              id
              UUID
              PRIMARY
              KEY,
              ts
              TIMESTAMPTZ
              NOT
              NULL,
              level
              TEXT
              NOT
              NULL,
              message
              TEXT
              NOT
              NULL,
              extra
              JSONB
          )
      `);

      await getPool().query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_ts ON activity_logs (ts DESC)`);

      await getPool().query(`
          CREATE TABLE IF NOT EXISTS processed_messages
          (
              message_id
              TEXT
              PRIMARY
              KEY,
              ts
              TIMESTAMPTZ
              NOT
              NULL
          )
      `);

      await getPool().query(`
          CREATE TABLE IF NOT EXISTS last_notifications
          (
              id
              BIGSERIAL
              PRIMARY
              KEY,
              ts
              TIMESTAMPTZ
              NOT
              NULL,
              payload
              JSONB
          )
      `);

      const createdAt = await getKvJson<string | null>('createdAt', null);
      if (!createdAt) {
        await upsertKvJson('createdAt', nowIso());
      }
    })();
  }

  await initPromise;
}

export async function readStore(): Promise<StoreSchema> {
  await ensureReady();

  const [createdAt, oauth, subscriptions, processedRows, notifications, logs] = await Promise.all([
    getKvJson<string>('createdAt', nowIso()),
    getOAuthStore(),
    getSubscriptionsStore(),
    getPool().query<{
      message_id: string;
      ts: string
    }>('SELECT message_id, ts FROM processed_messages ORDER BY ts DESC LIMIT 2000'),
    getLastNotifications(),
    getActivityLogs(),
  ]);

  return {
    createdAt,
    updatedAt: nowIso(),
    oauth,
    subscriptions,
    processedMessageIds: Object.fromEntries(processedRows.rows.map((row) => [row.message_id, row.ts])),
    lastNotifications: notifications,
    logs,
  };
}

export async function getOAuthStore() {
  await ensureReady();
  return getKvJson<StoreSchema['oauth']>('oauth', null);
}

export async function setOAuthStore(oauth: StoreSchema['oauth']) {
  await ensureReady();
  await Promise.all([upsertKvJson('oauth', oauth), upsertKvJson('updatedAt', nowIso())]);
}

export async function getSubscriptionsStore() {
  await ensureReady();
  return getKvJson<StoreSchema['subscriptions']>('subscriptions', []);
}

export async function saveSubscriptionsStore(subscriptions: StoreSchema['subscriptions']) {
  await ensureReady();
  await Promise.all([upsertKvJson('subscriptions', subscriptions), upsertKvJson('updatedAt', nowIso())]);
}

export async function getProcessedMessageCount() {
  await ensureReady();
  const {rows} = await getPool().query<{ count: string }>('SELECT COUNT(*)::text AS count FROM processed_messages');
  return Number(rows[0]?.count || '0');
}

export async function getLastNotifications(limit = MAX_LAST_NOTIFICATIONS) {
  await ensureReady();
  const {rows} = await getPool().query<{ ts: string; payload: unknown }>(
    'SELECT ts, payload FROM last_notifications ORDER BY ts DESC LIMIT $1',
    [limit],
  );
  return rows;
}

export async function getActivityLogs(limit = 300) {
  await ensureReady();
  const {rows} = await getPool().query<{ id: string; ts: string; level: LogLevel; message: string; extra: unknown }>(
    'SELECT id, ts, level, message, extra FROM activity_logs ORDER BY ts DESC LIMIT $1',
    [limit],
  );
  return rows;
}

export async function getGraphWebhookCertificateState() {
  await ensureReady();
  return getKvJson<GraphWebhookCertificateState | null>('graphWebhookCertState', null);
}

export async function saveGraphWebhookCertificateState(state: GraphWebhookCertificateState) {
  await ensureReady();
  await Promise.all([upsertKvJson('graphWebhookCertState', state), upsertKvJson('updatedAt', nowIso())]);
}

export async function writeStore(store: StoreSchema) {
  await ensureReady();
  await Promise.all([
    upsertKvJson('createdAt', store.createdAt),
    upsertKvJson('oauth', store.oauth),
    upsertKvJson('subscriptions', store.subscriptions || []),
    upsertKvJson('updatedAt', nowIso()),
  ]);
}

export async function appendLog(level: LogLevel, message: string, extra: unknown = null) {
  await ensureReady();
  const entry = {
    id: randomUUID(),
    ts: nowIso(),
    level,
    message,
    extra: toDbExtra(level, message, extra),
  };

  await getPool().query(
    `
        INSERT INTO activity_logs (id, ts, level, message, extra)
        VALUES ($1::uuid, $2::timestamptz, $3, $4, $5::jsonb)
    `,
    [entry.id, entry.ts, entry.level, entry.message, JSON.stringify(entry.extra)],
  );

  await getPool().query(`DELETE
                         FROM activity_logs
                         WHERE ts < NOW() - ($1::text || ' days')::interval`, [env.logRetentionDays]);

  const printer = level === 'error' ? console.error : console.log;
  printer(`[${entry.ts}] [${level}] ${message}`, extra ?? '');

  return entry;
}

export async function rememberProcessedMessage(messageId: string) {
  await ensureReady();
  await getPool().query(
    `
        INSERT INTO processed_messages (message_id, ts)
        VALUES ($1, $2::timestamptz) ON CONFLICT (message_id)
      DO
        UPDATE SET ts = EXCLUDED.ts
    `,
    [messageId, nowIso()],
  );

  await getPool().query(`DELETE
                         FROM processed_messages
                         WHERE ts < NOW() - INTERVAL '7 days'`);
}

export async function wasProcessedRecently(messageId: string, withinMinutes = 60 * 24) {
  await ensureReady();
  const {rows} = await getPool().query<{
    ts: string
  }>('SELECT ts FROM processed_messages WHERE message_id = $1', [messageId]);
  const ts = rows[0]?.ts;
  if (!ts) return false;
  const ageMs = Date.now() - new Date(ts).getTime();
  return ageMs < withinMinutes * 60 * 1000;
}

export async function pushLastNotification(payload: unknown) {
  await ensureReady();
  await getPool().query(`INSERT INTO last_notifications (ts, payload)
                         VALUES ($1::timestamptz, $2::jsonb)`, [
    nowIso(),
    JSON.stringify(sanitizeJson(payload)),
  ]);

  await getPool().query(
    `
        DELETE
        FROM last_notifications
        WHERE id NOT IN (SELECT id
                         FROM last_notifications
                         ORDER BY ts DESC
            LIMIT $1
            )
    `,
    [MAX_LAST_NOTIFICATIONS],
  );
}

