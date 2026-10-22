import type { Metadata } from 'next';
import { ReactNode } from 'react';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Ada The Coder: Python for kids aged 6 to 11',
  description: 'Ada The Coder teaches Python to children aged 6 to 11 with short, playful lessons on Windows and Mac.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Fredoka:wght@500;600&family=Nunito:wght@400;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
