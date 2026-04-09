'use client';

import { useLanguage } from '@/app/providers/language-provider';
import { t } from '@/lib/i18n';

export function LanguageSwitcher() {
  const {language, setLanguage} = useLanguage();

  return (
    <div className="language-switcher" title={t(language, 'language')}>
      <button
        className={`lang-button ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        aria-label="Switch to English"
      >
        EN
      </button>
      <button
        className={`lang-button ${language === 'zh' ? 'active' : ''}`}
        onClick={() => setLanguage('zh')}
        aria-label="切换到中文"
      >
        中文
      </button>
    </div>
  );
}

