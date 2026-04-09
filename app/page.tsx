import Link from 'next/link';
import type { ReactNode } from 'react';
import { DatabaseErrorPage } from '@/app/components/database-error-page';
import { ErrorPage } from '@/app/components/error-page';
import { isSessionAuthorized } from '@/backend/services/session';
import { getLogs, getStatus, getSubscriptions } from '@/backend/services/rescue';
import type { Language } from '@/lib/i18n';
import { detectPreferredLanguage, t } from '@/lib/i18n';
import { PageContent } from '@/app/components/page-content';

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

function getOauthNotice(code?: string, language: Language = 'en') {
  switch (code) {
    case 'ok':
      return {
        kind: 'success' as const,
        title: t(language, 'outlookBoundSuccess'),
        text: t(language, 'outlookBoundSuccessDesc'),
      };
    case 'invalid_state':
      return {
        kind: 'warn' as const,
        title: t(language, 'invalidCallbackState'),
        text: t(language, 'invalidCallbackStateDesc'),
      };
    case 'missing_code':
      return {
        kind: 'warn' as const,
        title: t(language, 'missingAuthorizationCode'),
        text: t(language, 'missingAuthorizationCodeDesc'),
      };
    case 'failed':
      return {
        kind: 'error' as const,
        title: t(language, 'outlookBindingFailed'),
        text: t(language, 'outlookBindingFailedDesc'),
      };
    default:
      return null;
  }
}

function Badge({tone, children}: { tone: 'success' | 'warn' | 'error' | 'muted'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function isDatabaseError(error: any): boolean {
  // Check for PostgreSQL connection errors
  if (error?.code === 'ECONNREFUSED') return true;
  if (error?.code === 'ENOTFOUND') return true;
  if (error?.message?.includes('connect')) return true;
  if (error?.message?.includes('timeout')) return true;

  // Check for AggregateError containing database errors
  if (error instanceof AggregateError) {
    return error.errors.some((e: any) => isDatabaseError(e));
  }

  return false;
}

export default async function HomePage({searchParams}: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const language = detectPreferredLanguage();

  try {
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
                <h2>{t(language, 'notAuthorizedTitle')}</h2>
                <p className="muted">{t(language, 'notAuthorizedDescription')}</p>
              </div>
              <Badge tone="muted">{t(language, 'notAuthorizedBadge')}</Badge>
            </div>

            <div className="actions">
              <Link href="/login" className="button">
                {t(language, 'login')}
              </Link>
            </div>
          </section>
        </main>
      );
    }

    const [status, logs, subscriptions] = await Promise.all([getStatus(), getLogs(), getSubscriptions()]);
    const account = status.account as GraphAccount | null;
    const oauthNotice = getOauthNotice(firstValue(resolvedSearchParams?.oauth), language);
    const hasOutlook = Boolean(status.oauth);
    const hasSubscriptions = subscriptions.length > 0;
    const latestSubscription = subscriptions[0] ?? null;

    return (
      <PageContent
        account={account}
        oauthNotice={oauthNotice}
        hasOutlook={hasOutlook}
        hasSubscriptions={hasSubscriptions}
        subscriptions={subscriptions}
        latestSubscription={latestSubscription}
        logs={logs}
      />
    );
  } catch (error: any) {
    // Handle database errors
    if (isDatabaseError(error)) {
      return <DatabaseErrorPage language={language}/>;
    }

    // Handle other errors with general error page
    return <ErrorPage language={language}/>;
  }
}

