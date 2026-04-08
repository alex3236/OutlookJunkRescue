export type LogLevel = 'info' | 'warn' | 'error';

export interface OAuthStore {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  tokenType: string;
  scope: string;
  expiresIn: number;
  expiresAt: string;
  savedAt: string;
}

export interface SubscriptionStore {
  id: string;
  resource: string;
  changeType: string;
  expirationDateTime: string;
  notificationUrl: string;
  applicationId: string;
  clientState: string;
  createdAt: string;
  renewedAt?: string;
}

export interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  message: string;
  extra: unknown;
}

export interface GraphWebhookCertificate {
  certId: string;
  certBase64: string;
  privateKeyPem: string;
  notAfter: string;
  createdAt: string;
}

export interface GraphWebhookCertificateState {
  active: GraphWebhookCertificate;
  previous: GraphWebhookCertificate[];
}

export interface StoreSchema {
  createdAt: string;
  updatedAt: string;
  oauth: OAuthStore | null;
  subscriptions: SubscriptionStore[];
  processedMessageIds: Record<string, string>;
  lastNotifications: Array<{ ts: string; payload: unknown }>;
  logs: LogEntry[];
}

