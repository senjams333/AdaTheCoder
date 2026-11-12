'use client';

import Link from 'next/link';
import { useGetSiteQuery } from '@/lib/api';
import HeroCode from '@/components/HeroCode';
import { Inline, items, Paragraphs } from '@/components/RichText';
import { useAppSelector } from '@/lib/hooks';

const DownloadIcon = () => (
  <svg className="dl-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5v11m0 0-4.5-4.5m4.5 4.5 4.5-4.5M4.5 19.5h15" />
  </svg>
);

/** The big headline. On phones it's two even lines, each on one line and sized to fit ("Your child's first" /
 *  "lines of real code"). A long headline the admin types just wraps as usual. */
function HeroTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  let best = 1, bestLen = Infinity;
  for (let k = 1; k < words.length; k++) {
    const len = Math.max(words.slice(0, k).join(' ').length, words.slice(k).join(' ').length);
    if (len < bestLen) { bestLen = len; best = k; }
  }
  if (words.length < 2 || bestLen > 22) return <h1>{text}</h1>;
  return (
    <h1 className="h1-two">
      <span className="h1-line">{words.slice(0, best).join(' ')}</span> <span className="h1-line">{words.slice(best).join(' ')}</span>
    </h1>
  );
}

/** The colours of the friends' cards, in turn (yellow, blue, pink). */
const FRIEND_LOOKS = ['friend-ada', 'friend-byte', 'friend-tom'];

export default function HomePage() {
  const { data } = useGetSiteQuery();
  const user = useAppSelector((s) => s.auth.user);
  const s = data?.settings || {};
  const mac = Boolean(data?.releases?.mac);      // a Mac version is uploaded (until then: "Mac coming soon")
  const paragraphs = (s.author_note || '').split('\n\n').map((p) => p.trim()).filter(Boolean);
  // the app's break reminder, as the admin set it (0 = off); parents are told about it below
  const breakN = Number.parseInt(s.break_minutes ?? '30', 10);
  const breakMinutes = Number.isNaN(breakN) ? 30 : Math.max(0, breakN);
  // the sections below are written by the admin (Website text → Home page sections); words in {braces} are filled in
  const vars = {
    break_minutes: String(breakMinutes),
    computers: mac ? 'Windows or Mac' : 'Windows (Mac coming soon)',
    mac: mac ? 'Mac computers running macOS 11 or newer work too.' : 'The Mac version is coming soon.',
    install_video: s.install_video_url || '#',
    email: s.contact_email || '',
  };
  // a fact or question about the break reminder is left out while the admin has turned breaks off
  const breaksOn = <T extends object>(x: T) => breakMinutes > 0 || !JSON.stringify(x).includes('{break_minutes}');
  const friends = items<{ name?: string; role?: string; text?: string; pic?: string }>(s.friends_items);
  const levels = items<{ label?: string; title?: string; text?: string; makes?: string }>(s.learn_items);
  const steps = items<{ title?: string; text?: string }>(s.steps_items);
  const facts = items<{ title?: string; text?: string }>(s.parents_facts).filter(breaksOn);
  const faqs = items<{ q?: string; a?: string }>(s.faq_items).filter(breaksOn);
  const half = Math.ceil(faqs.length / 2);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-text">
            <HeroTitle text={s.hero_title || "Your child's first lines of real code"} />
            <div>
              <p className="lede">{s.hero_subtitle}</p>
              <div className="actions">
                <Link className="btn btn-sun btn-hero" href={user ? '/account' : '/register'}>
                  <DownloadIcon />
                  {user ? 'Download the app' : 'Try Free!'}
                </Link>
              </div>
              <p className="small-print">{mac ? 'For Windows 10 or newer and macOS 11 or newer.' : 'For Windows 10 or newer. Mac: Coming Soon.'}</p>
            </div>
          </div>

          <div className="stage">
            <img className="twinkle" src="/img/twinkle.webp" alt="Twinkle the fairy waving her star wand" />
            <div className="tablet" aria-label="Example of a short Python program a child can write, and what it shows">
              <div className="tablet-frame">
                {/* the admin sets the file name, code and output on the Website text page */}
                <HeroCode file={s.hero_code_file} code={s.hero_code} output={s.hero_code_output} />
              </div>
            </div>
            <img className="ada" src="/img/ada.webp" alt="Ada, a smiling girl with round glasses, waving" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head wide">
            <h2>{s.friends_title}</h2>
            {s.friends_intro ? <p><Inline text={s.friends_intro} vars={vars} /></p> : null}
          </div>
          <div className="friends">
            {friends.map((f, i) => (
              <div className={`friend ${FRIEND_LOOKS[i % FRIEND_LOOKS.length]}`} key={i}>
                {f.pic ? <div className="pic"><img src={f.pic} alt={f.name || ''} /></div> : null}
                <h3>{f.name}</h3>
                {f.role ? <p className="role">{f.role}</p> : null}
                {f.text ? <p><Inline text={f.text} vars={vars} /></p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-lilac" id="lessons">
        <div className="wrap">
          <div className="section-head">
            <h2>{s.learn_title}</h2>
            {s.learn_intro ? <p><Inline text={s.learn_intro} vars={vars} /></p> : null}
          </div>
          <div className="path">
            {levels.map((l, i) => (
              <div className="level" key={i}>
                <span className="lv">{l.label || `Level ${i + 1}`}</span>
                <h3>{l.title}</h3>
                {l.text ? <p><Inline text={l.text} vars={vars} /></p> : null}
                {l.makes ? <p className="makes"><b>They&apos;ll make:</b> {l.makes}</p> : null}
              </div>
            ))}
          </div>
          {s.learn_note ? <p className="path-note"><Inline text={s.learn_note} vars={vars} /></p> : null}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="steps-head">
            <div className="section-head">
              <h2>{s.steps_title}</h2>
              {s.steps_intro ? <p><Inline text={s.steps_intro} vars={vars} /></p> : null}
            </div>
            {s.steps_bubble ? (
              <div className="byte-helper">
                <p className="byte-bubble"><Inline text={s.steps_bubble} vars={vars} /></p>
                <img src="/img/byte.webp" alt="Byte the owl waving" />
              </div>
            ) : null}
          </div>
          <ol className="steps">
            {steps.map((st, i) => (
              <li key={i}>
                <h3>{st.title}</h3>
                {st.text ? <p><Inline text={st.text} vars={vars} /></p> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section-mint" id="parents">
        <div className="wrap parents">
          <div>
            <h2>{s.parents_title}</h2>
            {s.parents_note ? <p><Inline text={s.parents_note} vars={vars} /></p> : null}
            {s.parents_ages ? <p><Inline text={s.parents_ages} vars={vars} /></p> : null}
            {s.parents_tip ? (
              <div className="byte-tip">
                <img src="/img/byte.webp" alt="" />
                <p><Inline text={s.parents_tip} vars={vars} /></p>
              </div>
            ) : null}
          </div>
          <ul className="facts">
            {facts.map((f, i) => (
              <li key={i}><span className="tick" aria-hidden="true">✓</span><span>{f.title ? <><b><Inline text={f.title} vars={vars} /></b> </> : null}<Inline text={f.text || ''} vars={vars} /></span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section-author" id="author">
        <div className="wrap">
          <article className="author-letter">
            <img className="author-avatar" src="/img/ada-face.png" alt="" />
            <h2>A note from the author</h2>
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            <p className="author-sign">Happy coding!<br /><span className="author-name">{s.author_name}</span></p>
            <p className="author-role">Creator of Ada The Coder</p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head"><h2>{s.faq_title}</h2></div>
          <div className="faq">
            {[faqs.slice(0, half), faqs.slice(half)].map((col, c) => (
              <div className="faq-col" key={c}>
                {col.map((f, i) => (
                  <details key={i}>
                    <summary><Inline text={f.q || ''} vars={vars} /></summary>
                    <Paragraphs text={f.a || ''} vars={vars} />
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

    </>
  );
}
