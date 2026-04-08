'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

const ACTION_LABELS: Record<ActionType, string> = {
  bindOutlook: '绑定Outlook',
  createSubscription: '创建订阅',
  disconnectOutlook: '取消订阅并解绑',
  renewAllSubscriptions: '续订全部订阅',
  reconcileTrash: '整理垃圾箱',
};

export function DashboardActions({
                                   outlookBound,
                                   subscriptionCount,
                                 }: DashboardActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<ActionType | null>(null);
  const [message, setMessage] = useState('');

  const formatResponse = async (response: Response, action: ActionType) => {
    const text = await response.text().catch(() => '');
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      switch (action) {
        case 'createSubscription':
          if (data?.id) {
            return `创建订阅成功：${data.id}`;
          }
          break;

        case 'disconnectOutlook':
          if (data) {
            return `已解绑 Outlook，删除订阅 ${data.deletedCount ?? 0} 个，失败 ${data.failedCount ?? 0} 个。`;
          }
          break;

        case 'renewAllSubscriptions':
          if (Array.isArray(data)) {
            const successCount = data.filter((item: any) => item?.ok).length;
            const failedCount = data.length - successCount;
            return `续订完成：成功 ${successCount} 个，失败 ${failedCount} 个。`;
          }
          break;

        case 'reconcileTrash':
          if (typeof data?.movedCount === 'number') {
            return `已整理垃圾箱，移动 ${data.movedCount} 封邮件。`;
          }
          break;
      }

      if (typeof data?.message === 'string' && data.message) {
        return data.message;
      }

      if (typeof data?.code === 'string' && data.code) {
        return data.code;
      }

      if (data?.ok === true) {
        switch (action) {
          case 'reconcileTrash':
            return '垃圾箱整理完成。';
          case 'renewAllSubscriptions':
            return '已提交全部订阅的续订请求。';
          case 'createSubscription':
            return '创建订阅完成。';
          case 'disconnectOutlook':
            return '已解绑 Outlook。';
          default:
            break;
        }
      }
    }

    return text || `${ACTION_LABELS[action]} completed.`;
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
        setMessage(`${ACTION_LABELS[action]} 失败: ${body}`);
        return;
      }

      const body = await formatResponse(response, action);
      setMessage(
        `${ACTION_LABELS[action]} 完成: ${body.slice(0, 260)}${
          body.length > 260 ? '...' : ''
        }`,
      );
      router.refresh();
    } catch {
      setMessage(`${ACTION_LABELS[action]} 因网络原因失败.`);
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
            {ACTION_LABELS.bindOutlook}
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
            {ACTION_LABELS.createSubscription}
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
            {ACTION_LABELS.disconnectOutlook}
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
            {ACTION_LABELS.renewAllSubscriptions}
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
            手动整理垃圾箱
          </button>
        ) : null}
      </div>

      {busy ? <p className="muted">执行中：{ACTION_LABELS[busy]}</p> : null}
      {message ? <pre>{message}</pre> : null}
    </div>
  );
}