'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FormErrors } from '@/components/Flashes';
import LessonForm from '@/components/LessonForm';
import { useBlankLessonQuery, useThemesQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';

function NewLesson() {
  const { data: themes } = useThemesQuery();
  const wanted = Number(useSearchParams().get('theme')) || themes?.[0]?.id || 0;
  const { data, error } = useBlankLessonQuery(wanted, { skip: !wanted, refetchOnMountOrArgChange: true });
  if (error) return <FormErrors errors={errorList(error)} />;
  if (themes && !themes.length) return <p>Add a theme first.</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return <LessonForm key={`new-${wanted}`} lesson={data} />;
}

export default function NewLessonPage() {
  return (
    <Suspense>
      <NewLesson />
    </Suspense>
  );
}
