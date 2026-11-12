import { Fragment, type ReactNode } from 'react';

/** The little code window on the home page (next to Ada): a file name, a few lines of Python (coloured like an
 *  editor) and "What it shows". The admin sets all three on the Website text page; these are used until then. */
export const HERO_CODE_DEFAULTS = {
  file: 'stars.py',
  code: 'for count_star in range(3):\n    print("Golden star ⭐")',
  output: 'Golden star ⭐\nGolden star ⭐\nGolden star ⭐',
};

const KEYWORDS = new Set(['for', 'in', 'if', 'elif', 'else', 'while', 'def', 'return', 'import', 'from', 'as', 'and', 'or',
  'not', 'True', 'False', 'None', 'break', 'continue', 'pass', 'class', 'with', 'try', 'except', 'lambda']);
const FUNCTIONS = new Set(['print', 'range', 'len', 'input', 'int', 'str', 'float', 'list', 'abs', 'round', 'min', 'max',
  'sum', 'sorted', 'random', 'randint', 'choice']);

/** One line of Python with keywords, functions, words in quotes and numbers coloured (the rest as typed). */
function colour(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /("[^"]*"?|'[^']*'?)|(#.*$)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1]) out.push(<span key={k++} className="str">{m[1]}</span>);
    else if (m[2]) out.push(<span key={k++} className="cm">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k++} className="num">{m[3]}</span>);
    else if (KEYWORDS.has(m[4])) out.push(<span key={k++} className="kw">{m[4]}</span>);
    else if (FUNCTIONS.has(m[4])) out.push(<span key={k++} className="fn">{m[4]}</span>);
    else out.push(m[4]);
    last = re.lastIndex;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export default function HeroCode({ file, code, output, animate = false }: { file?: string; code?: string; output?: string; animate?: boolean }) {
  const name = (file || '').trim() || HERO_CODE_DEFAULTS.file;
  const lines = ((code || '').replace(/\r/g, '').replace(/\t/g, '    ').trimEnd() || HERO_CODE_DEFAULTS.code).split('\n').slice(0, 8);
  while (lines.length < 4) lines.push(' ');                 // the window keeps its size with short code
  const shown = ((output || '').replace(/\r/g, '').trimEnd() || HERO_CODE_DEFAULTS.output).split('\n').slice(0, 6);
  return (
    <div className={animate ? 'screen animate' : 'screen'}>
      <div className="bar"><span>{name}</span><span className="run">▶ Run</span></div>
      {lines.map((l, i) => <div className="line" key={i}>{l.trim() ? colour(l) : ' '}</div>)}
      <div className="out">
        <div className="out-label">What it shows</div>
        {shown.map((l, i) => <Fragment key={i}>{l}<br /></Fragment>)}
        <span className="cursor" aria-hidden="true" />
      </div>
    </div>
  );
}
