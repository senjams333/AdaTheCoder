import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

/** Text the admin writes (Admin → Website text), shown on the website.
 *  In a line: **bold**, [link text](https://… or /page), {email} (the contact email, as a link) and the words in
 *  `vars`, e.g. {break_minutes}, filled in.
 *  Pages (Blocks): "# " the page title, "## " a heading, "#! " a big heading starting a part of the page, "{#name}" at
 *  the end of a heading gives it an address (/privacy#name), "- " a bullet, an empty line a new paragraph, and a line
 *  that is just {name} for one of `parts` (e.g. {grievance_officer}) puts that part there. */

export type Vars = Record<string, string>;

/** {name} → its value, for the words that are plain text (not {email}, which becomes a link). */
export function fill(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k !== 'email' && k in vars ? vars[k] : m));
}

function link(label: ReactNode, href: string, key: number) {
  if (href.startsWith('/')) return <Link key={key} href={href}>{label}</Link>;
  if (href === '#' || href === '') return <a key={key} href="#">{label}</a>;
  if (href.startsWith('mailto:') || href.startsWith('#')) return <a key={key} href={href}>{label}</a>;
  return <a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
}

/** One line of text, with bold, links and the {words} filled in. */
export function Inline({ text, vars = {} }: { text: string; vars?: Vars }): ReactNode {
  const t = fill(text, vars);
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]*)\)|\{email\}/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    if (m[1] !== undefined) out.push(<b key={k++}>{Inline({ text: m[1], vars })}</b>);
    else if (m[2] !== undefined) out.push(link(m[2], m[3], k++));
    else { const e = vars.email || ''; out.push(<a key={k++} href={`mailto:${e}`}>{e}</a>); }
    last = re.lastIndex;
  }
  if (last < t.length) out.push(t.slice(last));
  return <>{out}</>;
}

/** Paragraphs (an empty line between them), as in an answer to a question. */
export function Paragraphs({ text, vars }: { text: string; vars?: Vars }) {
  return <>{text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p, i) => <p key={i}><Inline text={p.replace(/\s*\n\s*/g, ' ')} vars={vars} /></p>)}</>;
}

/** A bullet: "Title: text" without any **bold** makes the title bold (the purchases text is written that way). */
function Bullet({ text, vars }: { text: string; vars: Vars }) {
  const c = text.indexOf(':');
  if (!text.includes('**') && c > 0 && c < 60) return <li><b>{text.slice(0, c + 1)}</b><Inline text={text.slice(c + 1)} vars={vars} /></li>;
  return <li><Inline text={text} vars={vars} /></li>;
}

/** A whole page of text (the Policies and Terms pages, and the purchases part). */
export function Blocks({ text, vars = {}, parts = {} }: { text: string; vars?: Vars; parts?: Record<string, ReactNode> }) {
  const out: ReactNode[] = [];
  let para: string[] = [], bullets: string[] = [];
  const flush = () => {
    if (para.length) {
      const p = para.join(' ');
      out.push(<p key={out.length} className={/^last updated/i.test(p) ? 'muted' : undefined}><Inline text={p} vars={vars} /></p>);
    }
    if (bullets.length) out.push(<ul key={out.length}>{bullets.map((b, i) => <Bullet key={i} text={b} vars={vars} />)}</ul>);
    para = []; bullets = [];
  };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    const part = /^\{(\w+)\}$/.exec(line);
    const head = /^(#!|##|#)\s+(.*?)(?:\s*\{#([\w-]+)\})?$/.exec(line);
    if (!line) { flush(); continue; }
    if (part && part[1] in parts) { flush(); out.push(<Fragment key={out.length}>{parts[part[1]]}</Fragment>); continue; }
    if (head) {
      flush();
      const [, mark, words, id] = head;
      const inner = <Inline text={words} vars={vars} />;
      if (mark === '#') out.push(<h1 key={out.length} id={id}>{inner}</h1>);
      else out.push(<h2 key={out.length} id={id} className={mark === '#!' ? 'part' : undefined}>{inner}</h2>);
      continue;
    }
    if (line.startsWith('- ')) {
      if (para.length) { const keep = bullets; bullets = []; flush(); bullets = keep; }
      bullets.push(line.slice(2).trim());
      continue;
    }
    if (bullets.length) flush();
    para.push(line);
  }
  flush();
  return <>{out}</>;
}

/** A list the admin keeps (friends, levels, steps, facts, questions), or [] if it can't be read. */
export function items<T>(json: string | undefined): T[] {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}
