'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/app/providers/language-provider';
import { t } from '@/lib/i18n';

type DashboardActionsProps = {
  outlookBound: boolean;
  subscriptionCount: number;
};

type ActionType =
  | 'bindOutlook'
  | 'createSubscription'
  | 'disconnectOutlook'
  | 'renewAllSubscriptions'
  | 'reconcileTrash';


export function DashboardActions({
                                   outlookBound,
                                   subscriptionCount,
                                 }: DashboardActionsProps) {
  const router = useRouter();
  const {language} = useLanguage();
  const [busy, setBusy] = useState<ActionType | null>(null);
  const [message, setMessage] = useState('');

  const getActionLabel = (action: ActionType): string => {
    const labels: Record<ActionType, string> = {
      bindOutlook: t(language, 'bindOutlook'),
      createSubscription: t(language, 'createSubscription'),
      disconnectOutlook: t(language, 'disconnectOutlook'),
      renewAllSubscriptions: t(language, 'renewAllSubscriptions'),
      reconcileTrash: t(language, 'reconcileTrash'),
    };
    return labels[action];
  };

  const formatResponse = async (response: Response, action: ActionType) => {
    const text = await response.text().catch(() => '');
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      let data: any;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      switch (action) {
        case 'createSubscription':
          if (data?.id) {
            return t(language, 'createSubscriptionSuccess', data?.id);
          }
          break;

        case 'disconnectOutlook':
          if (data) {
            return t(language, 'disconnectSuccessFormat', data.deletedCount ?? 0, data.failedCount ?? 0);
          }
          break;

        case 'renewAllSubscriptions':
          if (Array.isArray(data)) {
            const successCount = data?.filter((item: any) => item?.ok).length;
            const failedCount = data?.length - successCount;
            return t(language, 'renewSuccessFormat', successCount, failedCount);
          }
          break;

        case 'reconcileTrash':
          if (typeof data?.movedCount === 'number') {
            return t(language, 'reconcileSuccessFormat', data?.movedCount);
          }
          break;
      }

      if (typeof data?.message === 'string' && data?.message) {
        return data?.message;
      }

      if (typeof data?.code === 'string' && data?.code) {
        return data?.code;
      }

      if (data?.ok === true) {
        switch (action) {
          case 'reconcileTrash':
            return t(language, 'trashOrganizingComplete');
          case 'renewAllSubscriptions':
            return t(language, 'renewRequestSubmitted');
          case 'createSubscription':
            return t(language, 'createSubscriptionComplete');
          case 'disconnectOutlook':
            return t(language, 'disconnectedOutlook');
          default:
            break;
        }
      }
    }

    return text || t(language, 'actionCompleteFormat', getActionLabel(action));
  };

  const run = async (
    action: ActionType,
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    setBusy(action);
    setMessage('');

    try {
      const response = await fetch(input, init);

      if (!response.ok) {
        const body = await formatResponse(response, action);
        setMessage(`${t(language, 'actionFailedFormat', getActionLabel(action))}: ${body}`);
        return;
      }

      const body = await formatResponse(response, action);
      setMessage(
        `${t(language, 'actionCompleteFormat', getActionLabel(action))}: ${body.slice(0, 260)}${
          body.length > 260 ? '...' : ''
        }`,
      );
      router.refresh();
    } catch {
      setMessage(t(language, 'networkErrorActionFormat', getActionLabel(action)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="actions">
        {!outlookBound ? (
          <button
            onClick={() => {
              setBusy('bindOutlook');
              window.location.assign('/api/auth/oauth/login');
            }}
            disabled={Boolean(busy)}
          >
            {getActionLabel('bindOutlook')}
          </button>
        ) : null}

        {outlookBound && subscriptionCount === 0 ? (
          <button
            className="primary"
            onClick={() =>
              run('createSubscription', '/api/subscriptions/create', {
                method: 'POST',
              })
            }
            disabled={Boolean(busy)}
          >
            {getActionLabel('createSubscription')}
          </button>
        ) : null}

        {outlookBound && subscriptionCount > 0 ? (
          <button
            className="warn"
            onClick={() =>
              run('disconnectOutlook', '/api/auth/oauth/logout', {
                method: 'POST',
              })
            }
            disabled={Boolean(busy)}
          >
            {getActionLabel('disconnectOutlook')}
          </button>
        ) : null}

        {outlookBound && subscriptionCount > 0 ? (
          <button
            className="secondary"
            onClick={() =>
              run('renewAllSubscriptions', '/api/subscriptions/renew-all', {
                method: 'POST',
              })
            }
            disabled={Boolean(busy)}
          >
            {getActionLabel('renewAllSubscriptions')}
          </button>
        ) : null}

        {outlookBound ? (
          <button
            className="secondary"
            onClick={() =>
              run('reconcileTrash', '/api/reconcile', {
                method: 'POST',
              })
            }
            disabled={Boolean(busy)}
          >
            {getActionLabel('reconcileTrash')}
          </button>
        ) : null}
      </div>

      {busy ? <p className="muted">{t(language, 'actionExecutingFormat', getActionLabel(busy))}</p> : null}
      {message ? <pre>{message}</pre> : null}
    </div>
  );
}