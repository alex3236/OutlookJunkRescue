import axios, { type AxiosRequestConfig } from 'axios';
import { env, graphBase } from '@/backend/config/env';
import { getValidAccessToken } from '@/backend/services/oauth';
import { ensureActiveWebhookCertificate } from '@/backend/services/graph-webhook-certificate';

export async function graphRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const token = await getValidAccessToken();

  const response = await axios({
    ...config,
    headers: {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    timeout: config.timeout || 20000,
  });

  return response.data as T;
}

export async function graphGetMe() {
  return graphRequest({
    method: 'GET',
    url: `${graphBase}/me?$select=id,displayName,userPrincipalName,mail`,
  });
}

export async function createJunkSubscription() {
  if (!env.baseUrl.startsWith('https://')) {
    throw new Error('BASE_URL must use HTTPS for Graph rich notifications.');
  }

  const cert = await ensureActiveWebhookCertificate();
  const expiration = new Date(Date.now() + 1440 * 60 * 1000).toISOString();

  return graphRequest<any>({
    method: 'POST',
    url: `${graphBase}/subscriptions`,
    data: {
      changeType: 'created',
      notificationUrl: `${env.baseUrl}/api/webhook`,
      resource: `/me/mailFolders('junkemail')/messages?$select=id,subject,from,receivedDateTime`,
      expirationDateTime: expiration,
      clientState: env.webhookClientState,
      includeResourceData: true,
      encryptionCertificate: cert.certBase64,
      encryptionCertificateId: cert.certId,
    },
    headers: {'Content-Type': 'application/json'},
  });
}

export async function renewSubscription(subscriptionId: string, minutes = 45) {
  const expiration = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  return graphRequest<any>({
    method: 'PATCH',
    url: `${graphBase}/subscriptions/${subscriptionId}`,
    data: {expirationDateTime: expiration},
    headers: {'Content-Type': 'application/json'},
  });
}

export async function deleteSubscription(subscriptionId: string) {
  return graphRequest<void>({
    method: 'DELETE',
    url: `${graphBase}/subscriptions/${encodeURIComponent(subscriptionId)}`,
  });
}

export async function listJunkMessages(top = 20) {
  return graphRequest<any>({
    method: 'GET',
    url: `${graphBase}/me/mailFolders/junkemail/messages?$top=${top}&$select=id,subject,receivedDateTime,from,isRead,internetMessageId`,
  });
}

export async function moveMessageToInbox(messageId: string) {
  return graphRequest<any>({
    method: 'POST',
    url: `${graphBase}/me/messages/${encodeURIComponent(messageId)}/move`,
    data: {destinationId: 'inbox'},
    headers: {'Content-Type': 'application/json'},
  });
}

