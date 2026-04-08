'use client';

import { useState } from 'react';

export function PanelLogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogout = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        setError('登出失败，请稍后重试。');
        return;
      }

      // Force a full refresh so server-rendered auth state updates immediately.
      window.location.reload();
    } catch {
      setError('网络异常，暂时无法登出。');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="hero-actions">
      <button className="secondary" type="button" onClick={onLogout} disabled={pending}>
        {pending ? '登出中...' : '面板登出'}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}

