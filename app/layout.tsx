import './globals.css';
import type { Metadata } from 'next';
import { LanguageProvider } from '@/app/providers/language-provider';

export const metadata: Metadata = {
  title: 'Outlook Junk Rescue',
  description: 'A tool to help recover emails mistakenly marked as junk in Outlook.',
};

export default function RootLayout({children}: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
    <body>
    <LanguageProvider>{children}</LanguageProvider>
    </body>
    </html>
  );
}

