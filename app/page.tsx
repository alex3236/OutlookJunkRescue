import Link from 'next/link';
import type { ReactNode } from 'react';
import { DashboardActions } from '@/app/components/dashboard-actions';
import { PanelLogoutButton } from '@/app/components/panel-logout-button';
import { RecentActivityPanel } from '@/app/components/recent-activity-panel';
import { isSessionAuthorized } from '@/backend/services/session';
import { getLogs, getStatus, getSubscriptions } from '@/backend/services/rescue';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    oauth?: string | string[];
  }>;
};

type GraphAccount = {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  error?: string;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatShort(value?: string) {
  if (!value) return '—';
  return value;
}

function getOauthNotice(code?: string) {
  switch (code) {
    case 'ok':
      return { kind: 'success' as const, title: 'Outlook 已绑定', text: 'Microsoft 账户绑定成功，创建订阅以自动移动垃圾邮件。' };
    case 'invalid_state':
      return { kind: 'warn' as const, title: '回调状态无效', text: '已拒绝这次绑定回调，请重新点击“绑定Outlook”。' };
    case 'missing_code':
      return { kind: 'warn' as const, title: '回调缺少授权码', text: '绑定流程未返回 code，请重新绑定 Outlook。' };
    case 'failed':
      return { kind: 'error' as const, title: 'Outlook 绑定失败', text: '绑定回调处理失败，请稍后再试。' };
    default:
      return null;
  }
}

function Badge({ tone, children }: { tone: 'success' | 'warn' | 'error' | 'muted'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const authorized = await isSessionAuthorized();
  if (!authorized) {
    return (
      <main className="page">
        <section className="hero hero-compact">
          <h1>Outlook Junk Rescue</h1>
        </section>

        <section className="card status-shell">
          <div className="status-header">
            <div>
              <h2>当前未登录</h2>
              <p className="muted">请先进入登录页，然后再绑定 Outlook 和管理订阅。</p>
            </div>
            <Badge tone="muted">未登录</Badge>
          </div>

          <div className="actions">
            <Link href="/login" className="button">
              登录
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [status, logs, subscriptions] = await Promise.all([getStatus(), getLogs(), getSubscriptions()]);
  const account = status.account as GraphAccount | null;
  const oauthNotice = getOauthNotice(firstValue(resolvedSearchParams?.oauth));
  const hasOutlook = Boolean(status.oauth);
  const hasSubscriptions = subscriptions.length > 0;
  const latestSubscription = subscriptions[0] ?? null;

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-top">
          <h1>Outlook Junk Rescue</h1>
          <PanelLogoutButton />
        </div>
        <p>拯救神秘的 Outlook 垃圾邮件过滤器</p>
      </section>

      {oauthNotice ? (
        <section className={`notice notice-${oauthNotice.kind}`}>
          <strong>{oauthNotice.title}</strong>
          <p>{oauthNotice.text}</p>
        </section>
      ) : null}

      <div className="grid">
        <section className="card">
          <div className="status-header">
            <div>
              <h2>运行状态</h2>
            </div>
            <Badge tone="success">已登录</Badge>
          </div>

          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Outlook 绑定</span>
              <strong>{hasOutlook ? '已绑定' : '未绑定'}</strong>
            </div>
            <div className="status-item">
              <span className="status-label">订阅状态</span>
              <strong>{hasSubscriptions ? `已订阅（${subscriptions.length}）` : '未订阅'}</strong>
            </div>
            <div className="status-item">
              <span className="status-label">Token 到期时间</span>
              <strong>{status.oauth ? formatDateTime(status.oauth.expiresAt) : '—'}</strong>
            </div>
          </div>

          {account?.error ? <p className="error">用户信息读取失败：{account.error}</p> : null}
        </section>

        <section className="card">
          <div className="status-header">
            <div>
              <h2>操作面板</h2>
            </div>
          </div>

          <DashboardActions outlookBound={hasOutlook} subscriptionCount={subscriptions.length} />

          <div className="mini-summary">
            <div>
              <span className="status-label">当前订阅数</span>
              <strong>{subscriptions.length}</strong>
            </div>
            <div>
              <span className="status-label">最近订阅</span>
              <strong>{latestSubscription ? latestSubscription.id : '—'}</strong>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Outlook 账户</h2>

          <div className="detail-list">
            <div>
              <span className="status-label">显示名称</span>
              <strong>{formatShort(account?.displayName)}</strong>
            </div>
            <div>
              <span className="status-label">邮箱</span>
              <strong>{formatShort(account?.mail)}</strong>
            </div>
            <div>
              <span className="status-label">登录名</span>
              <strong>{formatShort(account?.userPrincipalName)}</strong>
            </div>
            <div>
              <span className="status-label">绑定状态</span>
              <strong>{hasOutlook ? '已绑定 Outlook' : '尚未绑定 Outlook'}</strong>
            </div>
            <div className="status-item">
              <span className="status-label">绑定时间</span>
              <strong>{status.oauth ? formatDateTime(status.oauth.savedAt) : '—'}</strong>
            </div>
          </div>
        </section>

        <section className="card card-wide">
          <h2>订阅列表</h2>

          {subscriptions.length === 0 ? (
            <p className="muted">当前还没有订阅，绑定 Outlook 后可以一键创建订阅。</p>
          ) : (
            <div className="subscription-list">
              {subscriptions.map((subscription) => (
                <article key={subscription.id} className="list-row">
                  <div className="list-row-main">
                    <strong>{subscription.resource}</strong>
                    <span className="muted">{subscription.changeType}</span>
                  </div>
                  <div className="list-row-meta">
                    <span>
                      <span className="status-label">到期</span> {formatDateTime(subscription.expirationDateTime)}
                    </span>
                    <span>
                      <span className="status-label">创建</span> {formatDateTime(subscription.createdAt)}
                    </span>
                    {subscription.renewedAt ? (
                      <span>
                        <span className="status-label">续订</span> {formatDateTime(subscription.renewedAt)}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <RecentActivityPanel logs={logs} />
      </div>
    </main>
  );
}

