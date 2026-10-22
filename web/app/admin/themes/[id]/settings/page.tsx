'use client';

import { useParams } from 'next/navigation';
import { FormErrors } from '@/components/Flashes';
import ThemeForm from '@/components/ThemeForm';
import { useThemeQuery } from '@/lib/api';
import { errorList } from '@/lib/errors';

export default function ThemeSettingsPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data, error } = useThemeQuery(id);
  if (error) return <FormErrors errors={errorList(error)} />;
  if (!data) return <p className="muted">Loading…</p>;
  return <ThemeForm key={data.theme.id} theme={data.theme} />;
}
