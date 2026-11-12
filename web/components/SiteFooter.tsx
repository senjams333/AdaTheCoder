'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useGetSiteQuery } from '@/lib/api';

export default function SiteFooter() {
  const { data } = useGetSiteQuery();
  const email = data?.settings.contact_email || 'ada@adathecoder.com';
  const s = data?.settings || {};
  // set in the admin (Website text); until then the buttons show but go nowhere
  // The icons are web/public/img/social/youtube.png, x.png and facebook.png (replace them to change the look).
  // If a file is missing, that button shows its name instead.
  const socials = [
    { key: 'youtube', label: 'YouTube', icon: '▶', url: s.social_youtube, cls: 'social yt' },
    { key: 'x', label: 'X', icon: '', url: s.social_x, cls: 'social xb' },
    { key: 'facebook', label: 'Facebook', icon: '', url: s.social_facebook, cls: 'social fb' },
  ];
  const [noIcon, setNoIcon] = useState<Record<string, boolean>>({});
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>© Ada The Coder. Made for curious kids and the grown-ups who help them.</span>
        <span className="socials" aria-label="Follow Ada The Coder">
          {socials.map((x) => (
            <a key={x.label} className={noIcon[x.key] ? x.cls : 'social-img'} aria-label={x.label} href={x.url || '#'} target={x.url ? '_blank' : undefined} rel="noopener noreferrer">
              {noIcon[x.key]
                ? <>{x.icon && <span aria-hidden="true">{x.icon}</span>}{x.label}</>
                : <img className="social-icon" src={`/img/social/${x.key}.png`} alt={x.label}
                    onError={() => setNoIcon((n) => ({ ...n, [x.key]: true }))} />}
            </a>
          ))}
        </span>
        <span>
          <Link href="/privacy">Privacy Policy</Link> &nbsp; <Link href="/privacy#purchases">Refund &amp; Cancellation</Link> &nbsp; <Link href="/terms">Terms &amp; Conditions</Link> &nbsp; <Link href="/contact">Contact</Link> &nbsp;{' '}
        </span>
      </div>
    </footer>
  );
}
