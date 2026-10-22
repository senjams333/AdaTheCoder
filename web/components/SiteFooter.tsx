'use client';

import Link from 'next/link';
import { useGetSiteQuery } from '@/lib/api';

export default function SiteFooter() {
  const { data } = useGetSiteQuery();
  const email = data?.settings.contact_email || 'ada@adathecoder.com';
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>© Ada The Coder. Made for curious kids and the grown-ups who help them.</span>
        <span>
          <Link href="/privacy">Privacy</Link> &nbsp; <Link href="/admin/login">Admin</Link> &nbsp;{' '}
          <a href={`mailto:${email}`}>{email}</a>
        </span>
      </div>
    </footer>
  );
}
