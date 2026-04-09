'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/providers/language-provider';
import { t } from '@/lib/i18n';
import type { LogEntry } from '@/backend/types/store';

type Props = {
  logs: LogEntry[];
};

type MailView = {
  id: string;
  ts: string;
  sender: string;
  subject: string;
};

function getSender(extra: unknown) {
  if (!extra || typeof extra !== 'object') return 'Unknown sender';
  const value = extra as Record<string, unknown>;
  const sender = value.sender;
  if (typeof sender === 'string' && sender.trim()) return sender;

  const from = value.from;
  if (from && typeof from === 'object') {
    const fromRecord = from as Record<string, unknown>;
    const emailAddress = fromRecord.emailAddress;
    if (emailAddress && typeof emailAddress === 'object') {
      const email = emailAddress as Record<string, unknown>;
      if (typeof email.name === 'string' && email.name.trim()) return email.name;
      if (typeof email.address === 'string' && email.address.trim()) return email.address;
    }
  }

  return 'Unknown sender';
}

function getSubject(extra: unknown) {
  if (!extra || typeof extra !== 'object') return 'No subject';
  const value = extra as Record<string, unknown>;
  const subject = value.subject;
  return typeof subject === 'string' && subject.trim() ? subject : 'No subject';
}

function isMailLog(log: LogEntry) {
  if (log.message.includes('Moved message from Junk to Inbox')) return true;
  if (!log.extra || typeof log.extra !== 'object') return false;
  const value = log.extra as Record<string, unknown>;
  return typeof value.subject === 'string' || typeof value.sender === 'string';
}

function formatDateTime(value: string, language: 'en' | 'zh' = 'en') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(date);
}

export function RecentActivityPanel({logs}: Props) {
  const router = useRouter();
  const {language} = useLanguage();
  const [mode, setMode] = useState<'logs' | 'mails'>('logs');
  const [displayLogs, setDisplayLogs] = useState(logs);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayLogs(logs);
  }, [logs]);

  const recentMails = useMemo<MailView[]>(() => {
    return displayLogs
      .filter(isMailLog)
      .map((log) => ({
        id: log.id,
        ts: log.ts,
        sender: getSender(log.extra),
        subject: getSubject(log.extra),
      }));
  }, [displayLogs]);

  async function refreshLogs() {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch('/api/logs', {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        setRefreshError(`${t(language, 'loadingLogsFailed')}: ${response.status}`);
        return;
      }

      const nextLogs = (await response.json()) as LogEntry[];
      if (!Array.isArray(nextLogs)) {
        setRefreshError(t(language, 'invalidLogsFormat'));
        return;
      }

      setDisplayLogs(nextLogs);
      router.refresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : t(language, 'refreshFailed'));
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="card card-wide">
      <div className="panel-toolbar">
        <h2>{t(language, 'activity')}</h2>
        <div className="panel-actions">
          <button
            type="button"
            className="button secondary small"
            onClick={refreshLogs}
            disabled={isRefreshing}
          >
            {isRefreshing ? t(language, 'refreshing') : t(language, 'refresh')}
          </button>

          <div className="toggle-group" role="tablist" aria-label="Activity mode">
            <button
              type="button"
              className={`toggle-button ${mode === 'logs' ? 'active' : ''}`}
              onClick={() => setMode('logs')}
              aria-pressed={mode === 'logs'}
            >
              {t(language, 'allLogs')}
            </button>
            <button
              type="button"
              className={`toggle-button ${mode === 'mails' ? 'active' : ''}`}
              onClick={() => setMode('mails')}
              aria-pressed={mode === 'mails'}
            >
              {t(language, 'movedEmails')}
            </button>
          </div>
        </div>
      </div>

      {refreshError ? <p className="error">{refreshError}</p> : null}

      {mode === 'logs' ? (
        displayLogs.length === 0 ? (
          <p className="muted">{t(language, 'noLogs')}</p>
        ) : (
          <div className="log-list">
            {displayLogs.slice(0, 10).map((log) => {
              const mailLog = isMailLog(log);
              return (
                <article key={log.id} className="list-row log-row">
                  <div className="log-inline">
                    {mailLog ? (
                      <span className="badge badge-success">MAIL</span>
                    ) : (
                      <span
                        className={`badge ${log.level === 'error' ? 'badge-error' : log.level === 'warn' ? 'badge-warn' : 'badge-muted'}`}>
                        {log.level.toUpperCase()}
                      </span>
                    )}
                    <div className="log-content">
                      <strong>{mailLog ? `${getSender(log.extra)} | ${getSubject(log.extra)}` : log.message}</strong>
                      <span className="muted">{formatDateTime(log.ts, language)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : recentMails.length === 0 ? (
        <p className="muted">{t(language, 'noRecentMails')}</p>
      ) : (
        <div className="log-list">
          {recentMails.slice(0, 20).map((mail) => (
            <article key={mail.id} className="list-row log-row">
              <div className="log-inline">
                <span className="badge badge-success">MAIL</span>
                <div className="log-content">
                  <strong>{`${mail.sender} | ${mail.subject}`}</strong>
                  <span className="muted">{formatDateTime(mail.ts, language)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

