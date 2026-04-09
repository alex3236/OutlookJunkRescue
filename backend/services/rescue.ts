import { env } from '@/backend/config/env';
import {
  appendLog,
  getActivityLogs,
  getLastNotifications,
  getOAuthStore,
  getProcessedMessageCount,
  getSubscriptionsStore,
  pushLastNotification,
  rememberProcessedMessage,
  saveSubscriptionsStore,
  setOAuthStore,
  wasProcessedRecently,
} from '@/backend/services/store';
import {
  createJunkSubscription,
  deleteSubscription,
  graphGetMe,
  listJunkMessages,
  moveMessageToInbox,
  renewSubscription,
} from '@/backend/services/graph';
import { decryptNotificationResource } from '@/backend/services/graph-webhook-crypto';
import { nowIso } from '@/backend/utils/time';

export async function getStatus() {
  const [oauth, subscriptions, processedCount, lastNotifications] = await Promise.all([
    getOAuthStore(),
    getSubscriptionsStore(),
    getProcessedMessageCount(),
    getLastNotifications(),
  ]);
  let me: unknown = null;

  try {
    if (oauth?.accessToken || oauth?.refreshToken) {
      me = await graphGetMe();
    }
  } catch (error: any) {
    me = {error: error?.response?.data || error?.message || 'Unknown error'};
  }

  return {
    now: nowIso(),
    config: {
      baseUrl: env.baseUrl,
      redirectUri: env.redirectUri,
      tenant: env.tenant,
      notificationUrl: `${env.baseUrl}/api/webhook`,
      storage: 'postgres',
    },
    account: me,
    oauth: oauth
      ? {
        tokenType: oauth.tokenType,
        scope: oauth.scope,
        expiresAt: oauth.expiresAt,
        savedAt: oauth.savedAt,
        hasRefreshToken: Boolean(oauth.refreshToken),
      }
      : null,
    subscriptions,
    processedCount,
    lastNotifications,
  };
}

export async function getLogs() {
  return getActivityLogs();
}

export async function createSubscriptionAndPersist() {
  const data = await createJunkSubscription();
  const subscriptions = await getSubscriptionsStore();

  const existingIndex = subscriptions.findIndex((s) => s.id === data.id);
  const record = {
    id: data.id,
    resource: data.resource,
    changeType: data.changeType,
    expirationDateTime: data.expirationDateTime,
    notificationUrl: data.notificationUrl,
    applicationId: data.applicationId,
    clientState: env.webhookClientState,
    createdAt: nowIso(),
  };

  if (existingIndex >= 0) {
    subscriptions[existingIndex] = record;
  } else {
    subscriptions.push(record);
  }

  await saveSubscriptionsStore(subscriptions);
  await appendLog('info', 'Created Graph subscription', {id: data.id});
  return data;
}

export async function getSubscriptions() {
  return getSubscriptionsStore();
}

export async function renewOneAndPersist(subscriptionId: string) {
  const data = await renewSubscription(subscriptionId);
  const subscriptions = await getSubscriptionsStore();
  const sub = subscriptions.find((s) => s.id === subscriptionId);

  if (sub) {
    sub.expirationDateTime = data.expirationDateTime || sub.expirationDateTime;
    sub.renewedAt = nowIso();
    await saveSubscriptionsStore(subscriptions);
  }

  await appendLog('info', 'Renewed Graph subscription', {id: subscriptionId});
  return data;
}

export async function renewAllAndPersist() {
  const subs = await getSubscriptionsStore();
  const results: Array<{ id: string; ok: boolean; renewed?: unknown; error?: unknown }> = [];

  for (const sub of subs) {
    try {
      const renewed = await renewOneAndPersist(sub.id);
      results.push({id: sub.id, ok: true, renewed});
    } catch (error: any) {
      results.push({
        id: sub.id,
        ok: false,
        error: error?.response?.data || {message: error?.message || 'Unknown error'},
      });
    }
  }

  return results;
}

export async function disconnectOutlookAndPersist() {
  const subscriptions = await getSubscriptionsStore();
  const results: Array<{ id: string; ok: boolean; error?: unknown }> = [];

  for (const sub of subscriptions) {
    try {
      await deleteSubscription(sub.id);
      results.push({id: sub.id, ok: true});
    } catch (error: any) {
      results.push({
        id: sub.id,
        ok: false,
        error: error?.response?.data || {message: error?.message || 'Unknown error'},
      });
    }
  }

  await Promise.all([saveSubscriptionsStore([]), setOAuthStore(null)]);

  const failedCount = results.filter((item) => !item.ok).length;
  await appendLog(failedCount > 0 ? 'warn' : 'info', 'Outlook disconnected', {
    deletedCount: results.length - failedCount,
    failedCount,
    results,
  });

  return {
    ok: failedCount === 0,
    deletedCount: results.length - failedCount,
    failedCount,
    results,
  };
}

export async function listJunk(top = 20) {
  return listJunkMessages(top);
}

function extractMessageIdFromResource(resource?: string) {
  if (!resource) return null;
  const match = resource.match(/messages\('([^']+)'\)/i);
  return match ? match[1] : null;
}

function pickSender(fromValue: any) {
  return fromValue?.emailAddress?.name || fromValue?.emailAddress?.address || fromValue?.name || fromValue?.address || null;
}

async function moveByMessageId(messageId: string, details?: {
  subject?: string;
  sender?: string | null;
  receivedDateTime?: string
}) {
  if (await wasProcessedRecently(messageId)) {
    return {skipped: true, reason: 'already_processed', messageId};
  }

  const moved = await moveMessageToInbox(messageId);
  const sender = details?.sender || pickSender(moved?.from);
  const subject = details?.subject || moved?.subject;
  await rememberProcessedMessage(messageId);
  await appendLog('info', 'Moved message from Junk to Inbox', {
    messageId,
    newId: moved.id,
    sender,
    subject,
    receivedDateTime: details?.receivedDateTime || null,
  });

  return {skipped: false, moved};
}

export async function handleWebhookPayload(payload: any) {
  await pushLastNotification(payload);

  const items = Array.isArray(payload?.value) ? payload.value : [];
  await appendLog('info', 'Webhook received notifications', items);

  for (const item of items) {
    if (item?.clientState !== env.webhookClientState) {
      await appendLog('warn', 'Ignored webhook due to clientState mismatch', item);
      continue;
    }

    let decrypted: { id?: string; subject?: string; from?: any; receivedDateTime?: string } | null = null;
    try {
      decrypted = await decryptNotificationResource(item);
    } catch (error: any) {
      await appendLog('warn', 'Failed to decrypt rich notification payload', {
        subscriptionId: item?.subscriptionId,
        message: error?.message || 'Unknown error',
      });
    }

    const messageId = item?.resourceData?.id || decrypted?.id || extractMessageIdFromResource(item.resource);
    if (!messageId) {
      await appendLog('warn', 'Webhook notification missing message id', item);
      continue;
    }

    try {
      await moveByMessageId(messageId, {
        subject: decrypted?.subject,
        sender: pickSender(decrypted?.from),
        receivedDateTime: decrypted?.receivedDateTime,
      });
    } catch (error: any) {
      await appendLog('error', 'Failed to process notification', {
        messageId,
        error: error?.response?.data || {message: error?.message || 'Unknown error'},
      });
    }
  }
}

export async function reconcileRecentJunkMessages(limit = 20) {
  const data = await listJunkMessages(limit);
  const moved = [];

  for (const msg of data.value || []) {
    if (!msg.id || (await wasProcessedRecently(msg.id))) continue;

    try {
      const result = await moveMessageToInbox(msg.id);
      const sender = pickSender(msg?.from) || pickSender(result?.from);
      await rememberProcessedMessage(msg.id);
      moved.push({oldId: msg.id, newId: result.id, sender, subject: result.subject || msg.subject});
      await appendLog('info', 'Moved message from Junk to Inbox', {
        messageId: msg.id,
        newId: result.id,
        sender,
        subject: result.subject || msg.subject,
      });
    } catch (error: any) {
      await appendLog('error', 'Failed to reconcile junk message', {
        messageId: msg.id,
        error: error?.response?.data || {message: error?.message || 'Unknown error'},
      });
    }
  }

  await appendLog('info', 'Reconcile completed', {movedCount: moved.length});
  return moved;
}

