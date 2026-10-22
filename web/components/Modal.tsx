'use client';

import { ReactNode, useEffect, useRef } from 'react';

/** A pop-up box using the browser's <dialog>: closes with ×, Esc, or a click outside it. */
export default function Modal({
  open, onClose, title, id, wide = false, children,
}: { open: boolean; onClose: () => void; title: string; id: string; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  // Esc closes the box: tell the page so it knows
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const closed = () => onClose();
    d.addEventListener('close', closed);
    return () => d.removeEventListener('close', closed);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      className={`acct-modal${wide ? ' acct-modal-wide' : ''}`}
      aria-labelledby={id}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <button type="button" className="acct-modal-x" onClick={onClose} aria-label="Close">×</button>
      <h2 id={id}>{title}</h2>
      {open ? children : null}
    </dialog>
  );
}
