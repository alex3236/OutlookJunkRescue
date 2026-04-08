function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

const baseUrl = mustEnv('BASE_URL').replace(/\/$/, '');
const redirectUri = new URL('/api/auth/oauth/callback', `${baseUrl}/`).toString();

export const env = {
  port: Number(process.env.PORT || 3000),
  baseUrl,
  clientId: mustEnv('CLIENT_ID'),
  clientSecret: mustEnv('CLIENT_SECRET'),
  tenant: process.env.TENANT || 'consumers',
  redirectUri,
  sessionSecret: mustEnv('SESSION_SECRET'),
  webhookClientState: mustEnv('WEBHOOK_CLIENT_STATE'),
  appPassword: mustEnv('APP_PASSWORD'),
  cronSecret: process.env.CRON_SECRET || '',
  databaseUrl: mustEnv('DATABASE_URL'),
  logRetentionDays: Number(process.env.LOG_RETENTION_DAYS || 7),
};

export const authBase = `https://login.microsoftonline.com/${env.tenant}/oauth2/v2.0`;
export const graphBase = 'https://graph.microsoft.com/v1.0';

export const scopes = [
  'openid',
  'offline_access',
  'https://graph.microsoft.com/User.Read',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.ReadWrite',
];

