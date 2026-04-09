import crypto from 'node:crypto';
import { getPrivateKeyForCertId } from '@/backend/services/graph-webhook-certificate';
import { appendLog } from '@/backend/services/store';

type EncryptedContent = {
  data?: string;
  dataKey?: string;
  dataSignature?: string;
  encryptionCertificateId?: string;
};

type NotificationItem = {
  id?: string;
  encryptedContent?: EncryptedContent;
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

class DecryptionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DecryptionError';
    if (options?.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

function decodeBase64(value: string, fieldName: string): Buffer {
  try {
    return Buffer.from(value, 'base64');
  } catch (error) {
    throw new DecryptionError(`Invalid base64 in field "${fieldName}".`, { cause: error });
  }
}

function decryptDataKey(dataKeyBase64: string, privateKeyPem: string): Buffer {
  try {
    const encryptedDataKey = decodeBase64(dataKeyBase64, 'dataKey');

    return crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      encryptedDataKey,
    );
  } catch (error) {
    throw new DecryptionError('Failed to decrypt dataKey with private key.', { cause: error });
  }
}

function getAesAlgorithm(rawKey: Buffer): 'aes-128-cbc' | 'aes-192-cbc' | 'aes-256-cbc' {
  switch (Math.min(rawKey.length, 32)) {
    case 16:
      return 'aes-128-cbc';
    case 24:
      return 'aes-192-cbc';
    case 32:
      return 'aes-256-cbc';
    default:
      throw new DecryptionError(`Unsupported symmetric key length: ${rawKey.length}.`);
  }
}

function decryptData(dataBase64: string, rawKey: Buffer): string {
  try {
    const cipherText = decodeBase64(dataBase64, 'data');
    const algorithm = getAesAlgorithm(rawKey);

    // Per Microsoft Graph encryptedContent contract:
    // use AES-CBC with PKCS7 padding, and set IV to the first 16 bytes
    // of the symmetric key used for decryption.
    const iv = rawKey.subarray(0, 16);

    const decipher = crypto.createDecipheriv(algorithm, rawKey, iv);
    decipher.setAutoPadding(true);

    const plaintext = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (error) {
    throw new DecryptionError('Failed to decrypt encrypted content data.', { cause: error });
  }
}

function verifySignature(dataBase64: string, rawKey: Buffer, signatureBase64?: string): boolean {
  if (!signatureBase64) {
    return false;
  }

  try {
    const dataBytes = decodeBase64(dataBase64, 'data');
    const receivedSignature = decodeBase64(signatureBase64.trim(), 'dataSignature');
    const expectedSignature = crypto.createHmac('sha256', rawKey).update(dataBytes).digest();

    if (expectedSignature.length !== receivedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedSignature, receivedSignature);
  } catch {
    return false;
  }
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new DecryptionError('Decrypted plaintext is not valid JSON.', { cause: error });
  }
}

function assertEncryptedContent(
  encrypted?: EncryptedContent,
): asserts encrypted is Required<Pick<EncryptedContent, 'data' | 'dataKey' | 'encryptionCertificateId'>> &
  EncryptedContent {
  if (!encrypted?.data) {
    throw new DecryptionError('Missing encryptedContent.data.');
  }

  if (!encrypted.dataKey) {
    throw new DecryptionError('Missing encryptedContent.dataKey.');
  }

  if (!encrypted.encryptionCertificateId) {
    throw new DecryptionError('Missing encryptedContent.encryptionCertificateId.');
  }
}

function sanitizeResourceForLog(resource: DecryptedMailResource) {
  return {
    id: resource.id,
    subjectLength: resource.subject?.length ?? 0,
    fromAddress: resource.from?.emailAddress?.address,
    receivedDateTime: resource.receivedDateTime,
  };
}

export async function decryptNotificationResource(
  item: NotificationItem,
): Promise<DecryptedMailResource | null> {
  const encrypted = item.encryptedContent;

  if (!encrypted?.data || !encrypted?.dataKey) {
    return null;
  }

  assertEncryptedContent(encrypted);

  const privateKeyPem = await getPrivateKeyForCertId(encrypted.encryptionCertificateId);
  const rawKey = decryptDataKey(encrypted.dataKey, privateKeyPem);

  const isValidSignature = verifySignature(encrypted.data, rawKey, encrypted.dataSignature);
  if (!isValidSignature) {
    throw new DecryptionError('Encrypted content signature verification failed.');
  }

  const plaintext = decryptData(encrypted.data, rawKey);
  const resource = parseJson<DecryptedMailResource>(plaintext);

  await appendLog('info', 'Decrypted notification resource.', {
    itemId: item.id,
    certificateId: encrypted.encryptionCertificateId,
    resource: sanitizeResourceForLog(resource),
  });

  return resource;
}