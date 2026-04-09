import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Outlook Junk Rescue',
  description: 'A tool to help recover emails mistakenly marked as junk in Outlook.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

