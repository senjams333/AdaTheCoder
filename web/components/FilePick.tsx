'use client';

import { useRef, useState } from 'react';
import { mb } from '@/lib/format';

/** A clear file chooser: a "Choose…" button, or drag the file onto it, and the chosen file's name, always shown from
 *  the form's own state. No type filter on the file window (on some Ubuntu desktops a filter hides or blocks the
 *  files): the website checks the type itself. Choosing the same file again works too. */
export default function FilePick({ id, accept, file, onFile, button, dropHint }: {
  id: string; accept?: string; file: File | null; onFile: (f: File | null) => void; button: string; dropHint?: string;
}) {
  const box = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const seen = useRef<File | null>(null);   // the file already handed on (so it isn't uploaded twice)
  return (
    <div className={over ? 'filepick over' : 'filepick'}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) { seen.current = f; onFile(f); } }}>
      <input ref={box} id={id} className="filepick-input" type="file" {...(accept ? { accept } : {})}
        onClick={(e) => {
          e.currentTarget.value = '';
          // Some Ubuntu browsers put the file in the box but never say so (no change event): when the file window
          // closes and the page has focus again, look in the box ourselves.
          const input = e.currentTarget;
          const look = () => {
            window.removeEventListener('focus', look);
            [300, 1000, 2500].forEach((ms) => setTimeout(() => {
              const f = input.files?.[0];
              if (f && f !== seen.current) { seen.current = f; onFile(f); }
            }, ms));
          };
          window.addEventListener('focus', look);
        }}
        onInput={(e) => { const f = e.currentTarget.files?.[0]; if (f && f !== seen.current) { seen.current = f; onFile(f); } }}
        onChange={(e) => { const f = e.target.files?.[0] || null; if (f !== seen.current) { seen.current = f; onFile(f); } }} />
      <label htmlFor={id} className="btn btn-small filepick-btn">{button}</label>
      <span className={file ? 'filepick-name chosen' : 'filepick-name'}>
        {file ? `${file.name} (${mb(file.size)})` : dropHint || 'No file chosen'}
      </span>
      {file ? (
        <button type="button" className="filepick-clear" title="Remove this file"
          onClick={() => { seen.current = null; onFile(null); if (box.current) box.current.value = ''; }}>✕</button>
      ) : null}
    </div>
  );
}
