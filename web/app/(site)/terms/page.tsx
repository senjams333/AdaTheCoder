'use client';

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
  const vars = { email, courts: city ? `at ${city}, India` : 'in India that have jurisdiction over our registered office' };
  return (
    <article className="prose wrap">
      <Blocks text={s.policy_terms || ''} vars={vars} parts={{ grievance_officer: <GrievanceOfficer />, business_details: <BusinessDetails /> }} />
    </article>
  );
}
