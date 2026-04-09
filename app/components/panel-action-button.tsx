'use client';

import { useState } from 'react';
import { useLanguage } from '@/app/providers/language-provider';
import { t } from '@/lib/i18n';
import { LanguageSwitcher } from '@/app/components/language-switcher';

export function PanelActionButton() {
  const {language} = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogout = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/logout', {method: 'POST'});
      if (!response.ok) {
        setError(t(language, 'logoutFailed'));
        return;
      }

      // Force a full refresh so server-rendered auth state updates immediately.
      window.location.reload();
    } catch {
      setError(t(language, 'networkErrorLogout'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="hero-actions">
      <LanguageSwitcher/>
      <button className="secondary small" type="button" onClick={onLogout} disabled={pending}>
        {pending ? t(language, 'logoutPending') : t(language, 'panelLogout')}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}

