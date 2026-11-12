'use client';

import { useEffect } from 'react';
import BusinessDetails, { useContact } from '@/components/BusinessDetails';
import GrievanceOfficer from '@/components/GrievanceOfficer';
import { Blocks } from '@/components/RichText';
import { useGetSiteQuery } from '@/lib/api';

/** Terms of use. The admin edits the text on the Website text page; {courts} names the courts of the city set there. */
export default function TermsPage() {
  const { email } = useContact();
  const { data } = useGetSiteQuery();
  const s = data?.settings || {};
  const city = (s.legal_city || '').trim();
  const vars = { email, year: String(new Date().getFullYear()), courts: city ? `at ${city}, India` : 'in India that have jurisdiction over our registered office' };
  const ready = Boolean(s.policy_terms);
  // the text arrives after the page opens, so a link to a part (/terms#copyright) scrolls there once it's shown
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (ready && id) document.getElementById(id)?.scrollIntoView();
  }, [ready]);
  return (
    <article className="prose wrap">
      <Blocks text={s.policy_terms || ''} vars={vars} parts={{ grievance_officer: <GrievanceOfficer />, business_details: <BusinessDetails /> }} />
    </article>
  );
}
