'use client';

import { useParams } from 'next/navigation';
import { FormErrors } from '@/components/Flashes';
import LessonForm from '@/components/LessonForm';
import { useLessonQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';

export default function EditLessonPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data, error } = useLessonQuery(id);
  if (error) return <FormErrors errors={errorList(error)} />;
  if (!data) return <p className="muted">Loading…</p>;
  return <LessonForm key={data.id} lesson={data} />;
}
