'use client';

import { useRef } from 'react';
import { mb } from '@/lib/format';

/** A clear file chooser: a "Choose…" button and the chosen file's name, always shown from the form's own state
 *  (not the browser's small file box). Choosing the same file again works too: the box is emptied when it opens. */
export default function FilePick({ id, accept, file, onFile, button }: {
  id: string; accept: string; file: File | null; onFile: (f: File | null) => void; button: string;
}) {
  const box = useRef<HTMLInputElement>(null);
  return (
    <div className="filepick">
      <input ref={box} id={id} className="filepick-input" type="file" accept={accept}
        onClick={(e) => { e.currentTarget.value = ''; }}
        onChange={(e) => onFile(e.target.files?.[0] || null)} />
      <label htmlFor={id} className="btn btn-small filepick-btn">{button}</label>
      <span className={file ? 'filepick-name chosen' : 'filepick-name'}>{file ? `${file.name} (${mb(file.size)})` : 'No file chosen'}</span>
      {file ? (
        <button type="button" className="filepick-clear" title="Remove this file"
          onClick={() => { onFile(null); if (box.current) box.current.value = ''; }}>✕</button>
      ) : null}
    </div>
  );
}
