import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Learn: Ada The Coder',
  description: 'Ada The Coder in your browser: Python lessons on tablets, phones and computers.',
  // installs as an app (Chrome's "Install app", Add to Home Screen, and the Android and iOS apps in mobile/)
  manifest: '/learn.webmanifest',
  appleWebApp: { capable: true, title: 'Ada The Coder', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#38bdf8' };

/** /learn has no website header or footer: it is the app, full screen. Its links are plain links (a full page
 *  load), because this page is sent with isolation headers (next.config.mjs) that other pages must not keep. */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return <div className="lr-root">{children}</div>;
}
