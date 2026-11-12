import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Learn: Ada The Coder',
  description: 'Ada The Coder in your browser: Python lessons on tablets, phones and computers.',
};

/** /learn has no website header or footer: it is the app, full screen. Its links are plain links (a full page
 *  load), because this page is sent with isolation headers (next.config.mjs) that other pages must not keep. */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return <div className="lr-root">{children}</div>;
}
