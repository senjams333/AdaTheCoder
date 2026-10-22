'use client';

import { dismiss } from '@/lib/flashSlice';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';

export default function Flashes({ className = 'flashes wrap' }: { className?: string }) {
  const messages = useAppSelector((s) => s.flash);
  const dispatch = useAppDispatch();
  if (!messages.length) return null;
  return (
    <ul className={className} role="status">
      {messages.map((m) => (
        <li key={m.id} className={`flash flash-${m.kind}`} onClick={() => dispatch(dismiss(m.id))} title="Click to close">
          {m.text}
        </li>
      ))}
    </ul>
  );
}

/** Mistakes in a form, shown above it. */
export function FormErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul className="flashes" role="alert">
      {errors.map((e) => (
        <li key={e} className="flash flash-error">{e}</li>
      ))}
    </ul>
  );
}
