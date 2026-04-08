import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { authBase, env, scopes } from '@/backend/config/env';
import { getOAuthStore, setOAuthStore } from '@/backend/services/store';
import { nowIso } from '@/backend/utils/time';
import { AppError } from '@/backend/errors/app-error';

export function buildAuthUrl() {
  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: env.clientId,
    response_type: 'code',
    redirect_uri: env.redirectUri,
    response_mode: 'query',
    scope: scopes.join(' '),
    state,
  });

  return {
    state,
    url: `${authBase}/authorize?${params.toString()}`,
  };
}

export async function exchangeCodeForToken(code: string) {
  const form = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.redirectUri,
    scope: scopes.join(' '),
  });

  const { data } = await axios.post(`${authBase}/token`, form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000,
  });

  return data;
}

async function refreshAccessToken(refreshToken: string) {
  const form = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    redirect_uri: env.redirectUri,
    scope: scopes.join(' '),
  });

  const { data } = await axios.post(`${authBase}/token`, form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20000,
  });

  return data;
}

export async function saveOAuthTokenResponse(tokenData: any) {
  const current = await getOAuthStore();
  const oauth = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || current?.refreshToken || null,
    idToken: tokenData.id_token || null,
    tokenType: tokenData.token_type,
    scope: tokenData.scope,
    expiresIn: tokenData.expires_in,
    expiresAt: new Date(Date.now() + (Number(tokenData.expires_in) - 120) * 1000).toISOString(),
    savedAt: nowIso(),
  };

  await setOAuthStore(oauth);
}

export async function getValidAccessToken() {
  const oauth = await getOAuthStore();

  if (!oauth?.refreshToken && !oauth?.accessToken) {
    throw new AppError(401, 'OAUTH_REQUIRED', 'No OAuth token found. Please authorize first.');
  }

  const expiresAt = oauth?.expiresAt ? new Date(oauth.expiresAt).getTime() : 0;
  const hasUsableToken = Boolean(oauth?.accessToken) && Date.now() < expiresAt;

  if (hasUsableToken && oauth?.accessToken) {
    return oauth.accessToken;
  }

  if (!oauth?.refreshToken) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired and no refresh token available.');
  }

  const refreshed = await refreshAccessToken(oauth.refreshToken);
  await saveOAuthTokenResponse(refreshed);
  return refreshed.access_token as string;
}

