'use client';

import { useGetSiteQuery } from '@/lib/api';

/** Who runs Ada The Coder and how to reach them (Admin → Website text → Business details). */
export function useContact() {
  const { data } = useGetSiteQuery();
  const s: Record<string, string> = data?.settings || {};
  return { email: s.contact_email || 'ada@adathecoder.com', details: (s.business_details || '').trim() };
}

export default function BusinessDetails() {
  const { email, details } = useContact();
  return (
    <address className="biz">
      {details && details.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
      Email: <a href={`mailto:${email}`}>{email}</a>
    </address>
  );
}
