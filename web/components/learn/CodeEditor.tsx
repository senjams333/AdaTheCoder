'use client';

import { KeyboardEvent, useRef } from 'react';

/** A simple code box for children: line numbers, Tab adds 4 spaces, Enter keeps the indent (and adds 4 after a
 *  line ending in ":"), no spelling marks or automatic capitals on tablets and phones. */
export default function CodeEditor({ value, onChange, onRun }: { value: string; onChange: (v: string) => void; onRun: () => void }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const nums = useRef<HTMLDivElement>(null);
  const lines = Math.max(value.split('\n').length, 6);

  function put(text: string, start: number, end: number, caret: number) {
    const el = box.current!;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = caret; });
  }

  function key(e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget, s = el.selectionStart, end = el.selectionEnd;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); put('    ', s, end, s + 4); return; }
    if (e.key === 'Enter') {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      let indent = (line.match(/^[ \t]*/) || [''])[0];
      if (/:\s*(#.*)?$/.test(line)) indent += '    ';
      if (indent) { e.preventDefault(); put('\n' + indent, s, end, s + 1 + indent.length); }
    }
  }

  return (
    <div className="lr-editor">
      <div className="lr-nums" ref={nums} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => <span key={i}>{i + 1}</span>)}
      </div>
      <textarea ref={box} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={key}
        onScroll={(e) => { if (nums.current) nums.current.scrollTop = e.currentTarget.scrollTop; }}
        spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" wrap="off"
        rows={lines} aria-label="Your Python code" />
    </div>
  );
}
