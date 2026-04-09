import { randomUUID } from 'node:crypto';
import { Elysia, t } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { env } from '@/backend/config/env';
import { normalizeUnknownError } from '@/backend/errors/app-error';
import { appendLog } from '@/backend/services/store';
import { buildAuthUrl, exchangeCodeForToken, saveOAuthTokenResponse } from '@/backend/services/oauth';
import { graphGetMe } from '@/backend/services/graph';
import {
  createSubscriptionAndPersist,
  disconnectOutlookAndPersist,
  getLogs,
  getStatus,
  getSubscriptions,
  handleWebhookPayload,
  listJunk,
  reconcileRecentJunkMessages,
  renewAllAndPersist,
  renewOneAndPersist,
} from '@/backend/services/rescue';
import { createPasswordToken, sessionCookieName, validatePasswordToken } from '@/backend/services/session';
import { fromSignedValue, toSignedValue } from '@/backend/services/signed-cookie';

const oauthStateCookie = 'oauth_state';
const sessionCookie = sessionCookieName();

const authenticatedSecurity: Record<string, string[]>[] = [
  {BearerAuth: []},
  {SessionCookieAuth: []},
];

const protectedRouteDetail = {
  security: authenticatedSecurity,
};

function redirectUrl(path: string) {
  return new URL(path, env.baseUrl).toString();
}

function cookieOptions(maxAgeSeconds: number) {
  const parts = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=${maxAgeSeconds}`];
  if (env.baseUrl.startsWith('https://')) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${encodeURIComponent(value)}; ${cookieOptions(maxAgeSeconds)}`;
}

function clearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function parseCookieHeader(raw: string | null) {
  if (!raw) return new Map<string, string>();
  const map = new Map<string, string>();

  for (const item of raw.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (!key) continue;
    map.set(key, decodeURIComponent(rest.join('=')));
  }

  return map;
}

function readBearerToken(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token || null;
}

function assertAuthorized(request: Request) {
  const bearerToken = readBearerToken(request);
  if (bearerToken && (bearerToken === env.appPassword || (env.cronSecret && bearerToken === env.cronSecret))) {
    return;
  }

  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const sessionRaw = cookies.get(sessionCookie);
  if (!validatePasswordToken(sessionRaw)) {
    throw new Error('UNAUTHORIZED');
  }
}

export const app = new Elysia({prefix: '/api'})
  .use(
    openapi({
      documentation: {
        info: {
          title: 'Outlook Rescue API',
          version: '20260408',
          description: `
用于管理 Outlook OAuth 绑定、Graph 订阅、垃圾箱整理和 webhook 回调。

## 认证方式

支持两种认证方式：

### 1. Session Cookie（用于 Dashboard）
先调用 \`POST /auth/login\`，请求体：

\`\`\`json
{ "password": "your-app-password" }
\`\`\`

成功后服务端会下发会话 Cookie，后续浏览器请求自动携带。

### 2. Bearer Token（推荐用于脚本 / 定时任务）
请求头：

\`\`\`
Authorization: Bearer <APP_PASSWORD or CRON_SECRET>
\`\`\`

## OAuth 流程

1. 先完成 \`POST /auth/login\`
2. 再访问 \`GET /auth/oauth/login\`
3. 跳转到 Microsoft 授权页
4. Microsoft 回调 \`GET /auth/oauth/callback\`
5. 成功后即可创建或续订订阅

## 返回约定

- 认证失败返回 \`401\`
- 错误响应通常为：

\`\`\`json
{
  "requestId": "uuid",
  "code": "UNAUTHORIZED",
  "message": "Missing or invalid auth."
}
\`\`\`
          `.trim(),
        },
        tags: [
          {name: 'System', description: '健康检查与系统状态'},
          {name: 'Auth', description: '密码登录、登出与 Outlook OAuth 绑定'},
          {name: 'Subscriptions', description: 'Microsoft Graph 订阅管理'},
          {name: 'Junk', description: '垃圾箱查询与整理'},
          {name: 'Webhook', description: 'Microsoft Graph webhook 回调'},
          {name: 'Logs', description: '运行日志'},
        ],
        security: authenticatedSecurity,
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              description: 'Use APP_PASSWORD or CRON_SECRET as bearer token.',
            },
            SessionCookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: sessionCookie,
              description: 'Use the dashboard session cookie returned by POST /auth/login.',
            },
          },
        },
      },
    }),
  )
  .get('/health', () => ({ok: true, ts: new Date().toISOString()}), {
    detail: {
      tags: ['System'],
      summary: '健康检查',
      description: '返回服务存活状态和当前时间戳。',
      security: [],
    },
  })
  .post(
    '/auth/login',
    async ({body, set}) => {
      if (body.password !== env.appPassword) {
        return new Response(
          JSON.stringify({ok: false, code: 'INVALID_PASSWORD', message: 'Password is incorrect.'}),
          {status: 401, headers: {'Content-Type': 'application/json'}},
        );
      }

      set.headers['set-cookie'] = setCookie(sessionCookie, createPasswordToken(body.password), 60 * 60 * 8);
      await appendLog('info', 'Dashboard password login success');
      return {ok: true};
    },
    {
      body: t.Object({
        password: t.String({minLength: 1, description: 'Dashboard password / APP_PASSWORD'}),
      }),
      detail: {
        tags: ['Auth'],
        security: [],
        summary: '密码登录',
        description: '校验应用密码，成功后写入 Dashboard Session Cookie。',
      },
    },
  )
  .post('/auth/logout', ({set}) => {
    set.headers['set-cookie'] = clearCookie(sessionCookie);
    return {ok: true};
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Auth'],
      summary: '登出 Dashboard',
      description: '清除 Dashboard Session Cookie。',
    },
  })
  .get('/auth/oauth/login', ({request, set}) => {
    try {
      assertAuthorized(request);
    } catch {
      return new Response(JSON.stringify({code: 'UNAUTHORIZED', message: 'Please login first.'}), {
        status: 401,
        headers: {'Content-Type': 'application/json'},
      });
    }

    const {state, url} = buildAuthUrl();
    set.headers['set-cookie'] = setCookie(oauthStateCookie, toSignedValue(state), 10 * 60);
    return Response.redirect(url, 302);
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Auth'],
      summary: '开始 Outlook OAuth 绑定',
      description: '生成 state，写入临时 Cookie，并重定向到 Microsoft 授权页面。',
    },
  })
  .get('/auth/oauth/callback', async ({query, request, set}) => {
    try {
      const cookies = parseCookieHeader(request.headers.get('cookie'));
      const stateFromCookie = fromSignedValue(cookies.get(oauthStateCookie));

      if (query.error) {
        await appendLog('error', 'OAuth callback returned error', {
          error: query.error,
          errorDescription: query.error_description,
        });
        return Response.redirect(redirectUrl('/?oauth=failed'), 302);
      }

      if (!query.code || typeof query.code !== 'string') {
        return Response.redirect(redirectUrl('/?oauth=missing_code'), 302);
      }

      if (!query.state || query.state !== stateFromCookie) {
        return Response.redirect(redirectUrl('/?oauth=invalid_state'), 302);
      }

      const tokenData = await exchangeCodeForToken(query.code);
      await saveOAuthTokenResponse(tokenData);
      await appendLog('info', 'OAuth token exchange success');

      try {
        const me = await graphGetMe();
        await appendLog('info', 'Graph /me success after OAuth callback', me);
      } catch (error: any) {
        await appendLog('warn', 'Graph /me failed after OAuth callback', {
          message: error?.message || 'Unknown error',
          data: error?.response?.data,
        });
      }

      set.headers['set-cookie'] = clearCookie(oauthStateCookie);
      return Response.redirect(redirectUrl('/?oauth=ok'), 302);
    } catch (error) {
      const normalized = normalizeUnknownError(error, 'OAuth callback failed');
      await appendLog('error', 'OAuth callback failed', normalized.details);
      return Response.redirect(redirectUrl('/?oauth=failed'), 302);
    }
  }, {
    detail: {
      tags: ['Auth'],
      security: [],
      summary: 'Outlook OAuth 回调',
      description: '处理 Microsoft 回调，校验 state，交换 token，并保存 OAuth 信息。',
    },
  })
  .get('/status', async ({request}) => {
    assertAuthorized(request);
    return getStatus();
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['System'],
      summary: '获取系统状态',
      description: '返回当前服务状态、OAuth 状态和基础运行信息。',
    },
  })
  .get('/logs', async ({request}) => {
    assertAuthorized(request);
    return getLogs();
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Logs'],
      summary: '获取运行日志',
      description: '返回最近的系统日志，用于排障和审计。',
    },
  })
  .get('/subscriptions', async ({request}) => {
    assertAuthorized(request);
    return getSubscriptions();
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Subscriptions'],
      summary: '列出订阅',
      description: '返回当前保存的 Microsoft Graph 订阅列表。',
    },
  })
  .post('/subscriptions/create', async ({request}) => {
    assertAuthorized(request);
    return createSubscriptionAndPersist();
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Subscriptions'],
      summary: '创建订阅',
      description: '创建新的 Microsoft Graph 订阅并持久化保存。',
    },
  })
  .post('/auth/oauth/logout', async ({request}) => {
    assertAuthorized(request);
    return disconnectOutlookAndPersist();
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Auth'],
      summary: '解绑 Outlook 并删除订阅',
      description: '断开 Outlook OAuth 绑定，并尝试删除已保存的订阅。',
    },
  })
  .post('/subscriptions/renew-all', async ({request}) => {
    assertAuthorized(request);
    return renewAllAndPersist();
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Subscriptions'],
      summary: '续订全部订阅',
      description: '对全部已有订阅发起续订，并同步持久化结果。',
    },
  })
  .get('/subscriptions/renew-all', async ({request}) => {
    assertAuthorized(request);
    return renewAllAndPersist();
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Subscriptions'],
      summary: '续订全部订阅（GET）',
      description: '兼容脚本或临时调用场景的 GET 版本。',
    },
  })
  .post('/subscriptions/renew/:id', async ({request, params}) => {
    assertAuthorized(request);
    return renewOneAndPersist(params.id);
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Subscriptions'],
      summary: '续订单个订阅',
      description: '按订阅 ID 续订指定订阅并更新持久化记录。',
    },
  })
  .get('/junk', async ({request}) => {
    assertAuthorized(request);
    return listJunk(20);
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Junk'],
      summary: '查看最近垃圾邮件',
      description: '返回最近一批垃圾邮件记录，默认最多 20 条。',
    },
  })
  .post('/reconcile', async ({request}) => {
    assertAuthorized(request);
    const moved = await reconcileRecentJunkMessages(20);
    return {movedCount: moved.length, moved};
  }, {
    detail: {
      ...protectedRouteDetail,
      tags: ['Junk'],
      summary: '整理垃圾箱',
      description: '检查最近垃圾邮件并执行整理逻辑，返回移动数量和明细。',
    },
  })
  .get('/webhook', async ({query}) => {
    const token = query.validationToken;
    if (typeof token === 'string' && token.length > 0) {
      await appendLog('info', 'Webhook validation via GET', {validationToken: token});
      return new Response(token, {status: 200, headers: {'Content-Type': 'text/plain'}});
    }
    return {ok: true};
  }, {
    detail: {
      tags: ['Webhook'],
      security: [],
      summary: 'Webhook 验证（GET）',
      description: '供 Microsoft Graph 在订阅验证阶段回显 validationToken。',
    },
  })
  .post('/webhook', async ({query, body}) => {
    const token = query.validationToken;
    if (typeof token === 'string' && token.length > 0) {
      await appendLog('info', 'Webhook validation via POST', {validationToken: token});
      return new Response(token, {status: 200, headers: {'Content-Type': 'text/plain'}});
    }

    Promise.resolve(handleWebhookPayload(body)).catch((error) => {
      const normalized = normalizeUnknownError(error, 'Webhook processing failed');
      void appendLog('error', 'Webhook processing failed', normalized.details);
    });

    return new Response(null, {status: 202});
  }, {
    detail: {
      tags: ['Webhook'],
      security: [],
      summary: '接收 Webhook 事件',
      description: '接收 Microsoft Graph 推送事件；验证请求时回显 token，正常事件异步处理并返回 202。',
    },
  })
  .onError(async ({code, error, path}) => {
    const requestId = randomUUID();
    const errorMessage = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';

    if (errorMessage === 'UNAUTHORIZED') {
      return new Response(
        JSON.stringify({
          requestId,
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid auth. Use dashboard session cookie or Authorization: Bearer <APP_PASSWORD|CRON_SECRET>.',
        }),
        {status: 401, headers: {'Content-Type': 'application/json'}},
      );
    }

    const normalized = normalizeUnknownError(error);
    await appendLog('error', 'API request failed', {
      requestId,
      code,
      path,
      error: normalized.details,
      message: normalized.message,
    });

    return new Response(
      JSON.stringify({
        requestId,
        code: normalized.code,
        message: normalized.message,
      }),
      {status: normalized.status, headers: {'Content-Type': 'application/json'}},
    );
  });