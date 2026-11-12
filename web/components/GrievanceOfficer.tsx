'use client';

import { useGetSiteQuery } from '@/lib/api';

/** The Grievance Officer's name and contact (Admin → Website text → Grievance Officer). Indian law asks websites
 *  that collect personal data or sell online to name one and say how to reach them. Without one set, the author's
 *  name and the contact email are shown. */
export function useGrievance() {
  const { data } = useGetSiteQuery();
  const s: Record<string, string> = data?.settings || {};
  const email = (s.grievance_email || s.contact_email || 'ada@adathecoder.com').trim();
  const name = (s.grievance_name || s.author_name || '').trim();
  const address = (s.business_details || '').trim().split('\n').map((l) => l.trim()).filter(Boolean);
  return { name, email, address };
}

export default function GrievanceOfficer() {
  const { name, email, address } = useGrievance();
  return (
    <address className="biz">
      {name ? <><b>{name}</b>, Grievance Officer<br /></> : <><b>Grievance Officer</b><br /></>}
      Email: <a href={`mailto:${email}?subject=Grievance`}>{email}</a><br />
      {address.map((line, i) => <span key={i}>{line}<br /></span>)}
    </address>
  );
}
