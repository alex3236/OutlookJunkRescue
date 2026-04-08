'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function RecentActivityPanel({ logs }: Props) {
  const router = useRouter();
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
        setRefreshError(`加载日志失败：${response.status}`);
        return;
      }

      const nextLogs = (await response.json()) as LogEntry[];
      if (!Array.isArray(nextLogs)) {
        setRefreshError('日志响应格式无效');
        return;
      }

      setDisplayLogs(nextLogs);
      router.refresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : '刷新失败，请稍后再试。');
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="card card-wide">
      <div className="panel-toolbar">
        <h2>活动</h2>
        <div className="panel-actions">
          <button
            type="button"
            className="button secondary small"
            onClick={refreshLogs}
            disabled={isRefreshing}
          >
            {isRefreshing ? '刷新中...' : '刷新'}
          </button>

          <div className="toggle-group" role="tablist" aria-label="Activity mode">
            <button
              type="button"
              className={`toggle-button ${mode === 'logs' ? 'active' : ''}`}
              onClick={() => setMode('logs')}
              aria-pressed={mode === 'logs'}
            >
              所有日志
            </button>
            <button
              type="button"
              className={`toggle-button ${mode === 'mails' ? 'active' : ''}`}
              onClick={() => setMode('mails')}
              aria-pressed={mode === 'mails'}
            >
              已移动邮件
            </button>
          </div>
        </div>
      </div>

      {refreshError ? <p className="error">{refreshError}</p> : null}

      {mode === 'logs' ? (
        displayLogs.length === 0 ? (
          <p className="muted">暂无日志。</p>
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
                      <span className={`badge ${log.level === 'error' ? 'badge-error' : log.level === 'warn' ? 'badge-warn' : 'badge-muted'}`}>
                        {log.level.toUpperCase()}
                      </span>
                    )}
                    <div className="log-content">
                      <strong>{mailLog ? `${getSender(log.extra)} | ${getSubject(log.extra)}` : log.message}</strong>
                      <span className="muted">{formatDateTime(log.ts)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : recentMails.length === 0 ? (
        <p className="muted">暂无最近移动的垃圾邮件。</p>
      ) : (
        <div className="log-list">
          {recentMails.slice(0, 20).map((mail) => (
            <article key={mail.id} className="list-row log-row">
              <div className="log-inline">
                <span className="badge badge-success">MAIL</span>
                <div className="log-content">
                  <strong>{`${mail.sender} | ${mail.subject}`}</strong>
                  <span className="muted">{formatDateTime(mail.ts)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

