import type { Language } from '@/lib/i18n';
import { t } from '@/lib/i18n';

type ErrorPageProps = {
  language?: Language;
  title?: string;
  description?: string;
};

export function ErrorPage({language = 'en', title, description}: ErrorPageProps) {
  const displayTitle = title || t(language, 'generalErrorTitle');
  const displayDescription = description || t(language, 'generalErrorDescription');

  return (
    <main className="page">
      <section className="hero hero-compact">
        <h1>Outlook Junk Rescue</h1>
      </section>

      <section className="card status-shell">
        <div className="status-header">
          <div>
            <h2>{displayTitle}</h2>
            <p className="muted">{displayDescription}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

