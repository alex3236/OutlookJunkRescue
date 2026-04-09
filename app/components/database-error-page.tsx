import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';

type DatabaseErrorPageProps = {
  language?: Language;
};

export function DatabaseErrorPage({language = 'en'}: DatabaseErrorPageProps) {
  return (
    <main className="page">
      <section className="hero hero-compact">
        <h1>Outlook Junk Rescue</h1>
      </section>

      <section className="card status-shell">
        <div className="status-header">
          <div>
            <h2>{t(language, 'databaseOfflineTitle')}</h2>
            <p className="muted">{t(language, 'databaseOfflineDescription')}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

