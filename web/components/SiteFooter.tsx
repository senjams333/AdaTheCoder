'use client';

import Link from 'next/link';
import { useGetSiteQuery } from '@/lib/api';

export default function SiteFooter() {
  const { data } = useGetSiteQuery();
  const email = data?.settings.contact_email || 'ada@adathecoder.com';
  const s = data?.settings || {};
  // set in the admin (Website text); until then the buttons show but go nowhere
  const socials = [
    { label: 'YouTube', icon: '▶', url: s.social_youtube },
    { label: 'X', icon: '', url: s.social_x },
    { label: 'Facebook', icon: '', url: s.social_facebook },
  ];
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>© Ada The Coder. Made for curious kids and the grown-ups who help them.</span>
        <span className="socials" aria-label="Follow Ada The Coder">
          {socials.map((x) => (
            <a key={x.label} className="social" href={x.url || '#'} target={x.url ? '_blank' : undefined} rel="noopener noreferrer">
              {x.icon && <span aria-hidden="true">{x.icon}</span>}{x.label}
            </a>
          ))}
        </span>
        <span>
          <Link href="/privacy">Policies</Link> &nbsp; <Link href="/terms">Terms &amp; Conditions</Link> &nbsp; <Link href="/contact">Contact</Link> &nbsp;{' '}
          <a href={`mailto:${email}`}>{email}</a>
        </span>
      </div>
    </footer>
  );
}
