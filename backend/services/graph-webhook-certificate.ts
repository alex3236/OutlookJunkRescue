import { randomUUID } from 'node:crypto';
import { X509Certificate } from 'node:crypto';
import selfsigned from 'selfsigned';
import { nowIso } from '@/backend/utils/time';
import {
  getGraphWebhookCertificateState,
  saveGraphWebhookCertificateState,
} from '@/backend/services/store';
import type { GraphWebhookCertificate } from '@/backend/types/store';

const CERT_VALID_DAYS = Number(process.env.GRAPH_CERT_VALID_DAYS || 3650);
const RENEW_BEFORE_DAYS = Number(process.env.GRAPH_CERT_RENEW_BEFORE_DAYS || 30);
const MAX_OLD_CERTS = 5;

function normalizeCertToBase64(pem: string) {
  return pem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\r/g, '')
    .replace(/\n/g, '')
    .trim();
}

function createCertificate(): GraphWebhookCertificate {
  const attrs = [{ name: 'commonName', value: 'outlook-rescue-graph-webhook' }];
  const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    keySize: 2048,
    days: CERT_VALID_DAYS,
  });

  const parsed = new X509Certificate(pems.cert);

  return {
    certId: randomUUID().replace(/-/g, ''),
    certBase64: normalizeCertToBase64(pems.cert),
    privateKeyPem: pems.private,
    notAfter: new Date(parsed.validTo).toISOString(),
    createdAt: nowIso(),
  };
}

function shouldRenew(cert: GraphWebhookCertificate) {
  const expireAt = new Date(cert.notAfter).getTime();
  if (Number.isNaN(expireAt)) return true;
  const renewBeforeMs = RENEW_BEFORE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() >= expireAt - renewBeforeMs;
}

export async function ensureActiveWebhookCertificate() {
  const state = await getGraphWebhookCertificateState();

  if (!state?.active) {
    const active = createCertificate();
    await saveGraphWebhookCertificateState({ active, previous: [] });
    return active;
  }

  if (!shouldRenew(state.active)) {
    return state.active;
  }

  const renewed = createCertificate();
  const previous = [state.active, ...(state.previous || [])].slice(0, MAX_OLD_CERTS);
  await saveGraphWebhookCertificateState({ active: renewed, previous });
  return renewed;
}

export async function getPrivateKeyForCertId(certId?: string) {
  const state = await getGraphWebhookCertificateState();
  if (!state?.active) {
    const active = await ensureActiveWebhookCertificate();
    return active.privateKeyPem;
  }

  if (!certId || certId === state.active.certId) {
    return state.active.privateKeyPem;
  }

  const previous = (state.previous || []).find((item) => item.certId === certId);
  if (previous) {
    return previous.privateKeyPem;
  }

  throw new Error(`Unknown encryption certificate id: ${certId}`);
}

