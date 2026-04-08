import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Outlook Rescue',
  description: 'Outlook junk rescue dashboard powered by Next.js + Elysia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

