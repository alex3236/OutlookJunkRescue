'use client';

import type { ReactNode } from 'react';
import { DashboardActions } from '@/app/components/dashboard-actions';
import { PanelActionButton } from '@/app/components/panel-action-button';
import { RecentActivityPanel } from '@/app/components/recent-activity-panel';
import { useLanguage } from '@/app/providers/language-provider';
import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { LogEntry, SubscriptionStore } from '@/backend/types/store';

type GraphAccount = {
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  error?: string;
};

type OAuthNotice = {
  kind: 'success' | 'warn' | 'error' | 'muted';
  title: string;
  text: string;
} | null;

type PageContentProps = {
  account: GraphAccount | null;
  oauthNotice: OAuthNotice;
  hasOutlook: boolean;
  hasSubscriptions: boolean;
  subscriptions: SubscriptionStore[];
  latestSubscription: SubscriptionStore | null;
  logs: LogEntry[];
};

function formatDateTime(value?: string, language: Language = 'en') {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function Badge({tone, children}: { tone: 'success' | 'warn' | 'error' | 'muted'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageContent({
                              account,
                              oauthNotice,
                              hasOutlook,
                              hasSubscriptions,
                              subscriptions,
                              latestSubscription,
                              logs,
                            }: PageContentProps) {
  const {language} = useLanguage();

  const formatShort = (value?: string) => (value ? value : '—');

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-top">
          <div className="hero-title">
            <h1>{t(language, 'appTitle')}</h1>
            <p className="hero-tagline">{t(language, 'appTagline')}</p>
          </div>
          <PanelActionButton/>
        </div>
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
              <h2>{t(language, 'statusTitle')}</h2>
            </div>
            <Badge tone="success">{t(language, 'statusLoggedIn')}</Badge>
          </div>

          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">{t(language, 'outlookBinding')}</span>
              <strong>{hasOutlook ? t(language, 'outlookBound') : t(language, 'outlookNotBound')}</strong>
            </div>
            <div className="status-item">
              <span className="status-label">{t(language, 'subscriptionStatus')}</span>
              <strong>{hasSubscriptions ? t(language, 'subscriptionCount', subscriptions.length) : t(language, 'notSubscribed')}</strong>
            </div>
            <div className="status-item">
              <span className="status-label">{t(language, 'tokenExpiration')}</span>
              <strong>{account?.error ? formatDateTime(undefined, language) : formatDateTime((account as any)?.expiresAt, language)}</strong>
            </div>
          </div>

          {account?.error ? <p className="error">{t(language, 'userInfoFailed')}: {account.error}</p> : null}
        </section>

        <section className="card">
          <div className="status-header">
            <div>
              <h2>{t(language, 'operationPanel')}</h2>
            </div>
          </div>

          <DashboardActions outlookBound={hasOutlook} subscriptionCount={subscriptions.length}/>

          <div className="mini-summary">
            <div>
              <span className="status-label">{t(language, 'currentSubscriptions')}</span>
              <strong>{subscriptions.length}</strong>
            </div>
            <div>
              <span className="status-label">{t(language, 'recentSubscription')}</span>
              <strong>{latestSubscription ? latestSubscription.id : '—'}</strong>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>{t(language, 'outlookAccount')}</h2>

          <div className="detail-list">
            <div>
              <span className="status-label">{t(language, 'displayName')}</span>
              <strong>{formatShort(account?.displayName)}</strong>
            </div>
            <div>
              <span className="status-label">{t(language, 'email')}</span>
              <strong>{formatShort(account?.mail)}</strong>
            </div>
            <div>
              <span className="status-label">{t(language, 'loginName')}</span>
              <strong>{formatShort(account?.userPrincipalName)}</strong>
            </div>
            <div>
              <span className="status-label">{t(language, 'bindingStatus')}</span>
              <strong>{hasOutlook ? t(language, 'boundOutlook') : t(language, 'notBoundOutlook')}</strong>
            </div>
            <div className="status-item">
              <span className="status-label">{t(language, 'bindingTime')}</span>
              <strong>{account ? formatDateTime((account as any)?.savedAt, language) : '—'}</strong>
            </div>
          </div>
        </section>

        <section className="card card-wide">
          <h2>{t(language, 'subscriptionsList')}</h2>

          {subscriptions.length === 0 ? (
            <p className="muted">{t(language, 'noSubscriptions')}</p>
          ) : (
            <div className="subscription-list">
              {subscriptions.map((subscription) => (
                <article key={subscription.id} className="list-row">
                  <div className="list-row-main">
                    <strong>{subscription.id}</strong>
                    <span className="muted">{subscription.changeType}</span>
                  </div>
                  <div className="list-row-meta">
                    <span>
                      <span
                        className="status-label">{t(language, 'expiration')}</span> {formatDateTime(subscription.expirationDateTime, language)}
                    </span>
                    <span>
                      <span
                        className="status-label">{t(language, 'created')}</span> {formatDateTime(subscription.createdAt, language)}
                    </span>
                    {subscription.renewedAt ? (
                      <span>
                        <span
                          className="status-label">{t(language, 'renewed')}</span> {formatDateTime(subscription.renewedAt, language)}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <RecentActivityPanel logs={logs}/>
      </div>
    </main>
  );
}





