import { ReactNode } from 'react';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

/** Header, messages, page and footer for the public and parent pages. */
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
