'use client';

import { useEffect } from 'react';
import BusinessDetails, { useContact } from '@/components/BusinessDetails';
import GrievanceOfficer from '@/components/GrievanceOfficer';
import { Blocks } from '@/components/RichText';
import { useGetSiteQuery } from '@/lib/api';

/** Our policies: privacy (written as the notice India's Digital Personal Data Protection Act, 2023 and its Rules ask
 *  for), then purchases, delivery, cancellation and refunds. The admin edits both texts on the Website text page. */
export default function PrivacyPage() {
  const { email } = useContact();
  const { data } = useGetSiteQuery();
  const s = data?.settings || {};
  const vars = { email };
  const ready = Boolean(s.policy_privacy);
  // the text arrives after the page opens, so a link to a part (/privacy#purchases) scrolls there once it's shown
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (ready && id) document.getElementById(id)?.scrollIntoView();
  }, [ready]);
  return (
    <article className="prose wrap">
      <Blocks text={s.policy_privacy || ''} vars={vars} parts={{
        grievance_officer: <GrievanceOfficer />,
        business_details: <BusinessDetails />,
        purchases: <Blocks text={s.policy_purchases || ''} vars={vars} />,
      }} />
    </article>
  );
}
