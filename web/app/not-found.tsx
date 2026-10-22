import Link from 'next/link';
import SiteShell from '@/components/SiteShell';

export default function NotFound() {
  return (
    <SiteShell>
      <section className="auth wrap">
        <div className="auth-card">
          <img className="error-art" src="/img/byte.webp" alt="" />
          <h1>Page not found</h1>
          <p>We couldn&apos;t find that page. It may have moved.</p>
          <Link className="btn" href="/">Go to the home page</Link>
        </div>
      </section>
    </SiteShell>
  );
}
