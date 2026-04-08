import crypto from 'node:crypto';
import { getPrivateKeyForCertId } from '@/backend/services/graph-webhook-certificate';

type EncryptedContent = {
  data?: string;
  dataKey?: string;
  dataSignature?: string;
  encryptionCertificateId?: string;
};

export type DecryptedMailResource = {
  id?: string;
  subject?: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  receivedDateTime?: string;
};

function decodeBase64(value: string) {
  return Buffer.from(value, 'base64');
}

function decryptDataKey(dataKeyBase64: string, privateKeyPem: string) {
  const encryptedDataKey = decodeBase64(dataKeyBase64);
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha1',
    },
    encryptedDataKey,
  );
}

function splitEncryptedData(dataBase64: string) {
  if (dataBase64.includes(':')) {
    const [ivBase64, cipherBase64] = dataBase64.split(':');
    if (!ivBase64 || !cipherBase64) {
      throw new Error('Invalid encrypted data format.');
    }
    return { iv: decodeBase64(ivBase64), cipher: decodeBase64(cipherBase64) };
  }

  const payload = decodeBase64(dataBase64);
  if (payload.length <= 16) {
    throw new Error('Encrypted payload is too short.');
  }

  return {
    iv: payload.subarray(0, 16),
    cipher: payload.subarray(16),
  };
}

function decryptData(dataBase64: string, rawKey: Buffer) {
  const { iv, cipher } = splitEncryptedData(dataBase64);
  const key = rawKey.length >= 32 ? rawKey.subarray(0, 32) : rawKey;

  const algorithm = key.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc';
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAutoPadding(true);

  const plaintext = Buffer.concat([decipher.update(cipher), decipher.final()]);
  return plaintext.toString('utf8');
}

function verifySignature(payload: string, rawKey: Buffer, signatureBase64?: string) {
  if (!signatureBase64) return true;

  const expected = crypto.createHmac('sha256', rawKey).update(payload, 'utf8').digest('base64');
  const received = signatureBase64.trim();

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function decryptNotificationResource(item: any): Promise<DecryptedMailResource | null> {
  const encrypted = item?.encryptedContent as EncryptedContent | undefined;
  if (!encrypted?.data || !encrypted?.dataKey) return null;

  const privateKeyPem = await getPrivateKeyForCertId(encrypted.encryptionCertificateId);
  const rawKey = decryptDataKey(encrypted.dataKey, privateKeyPem);
  const plaintext = decryptData(encrypted.data, rawKey);

  if (!verifySignature(plaintext, rawKey, encrypted.dataSignature)) {
    throw new Error('Encrypted content signature verification failed.');
  }

  return JSON.parse(plaintext) as DecryptedMailResource;
}



