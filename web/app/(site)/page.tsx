'use client';

import Link from 'next/link';
import { useGetSiteQuery } from '@/lib/api';
import { useAppSelector } from '@/lib/hooks';

const DownloadIcon = () => (
  <svg className="dl-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5v11m0 0-4.5-4.5m4.5 4.5 4.5-4.5M4.5 19.5h15" />
  </svg>
);

export default function HomePage() {
  const { data } = useGetSiteQuery();
  const user = useAppSelector((s) => s.auth.user);
  const s = data?.settings || {};
  const paragraphs = (s.author_note || '').split('\n\n').map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-text">
            <h1>{s.hero_title || "Your child's first lines of real code"}</h1>
            <div>
              <p className="lede">{s.hero_subtitle}</p>
              <div className="actions">
                <Link className="btn btn-sun btn-hero" href={user ? '/account' : '/register'}>
                  <DownloadIcon />
                  {user ? 'Download the app' : 'Download'}
                </Link>
              </div>
              <p className="small-print">For Windows 10 or newer and macOS 11 or newer.</p>
            </div>
          </div>

          <div className="stage">
            <img className="twinkle" src="/img/twinkle.webp" alt="Twinkle the fairy waving her star wand" />
            <div className="tablet" aria-label="Example of a short Python program a child can write, and what it shows">
              <div className="tablet-frame">
                <div className="screen animate">
                  <div className="bar"><span>rocket.py</span><span className="run">▶ Run</span></div>
                  <div className="line"><span className="kw">for</span> n <span className="kw">in</span> <span className="fn">range</span>(<span className="num">3</span>, <span className="num">0</span>, <span className="num">-1</span>):</div>
                  <div className="line">{'    '}<span className="fn">print</span>(n)</div>
                  <div className="line"><span className="fn">print</span>(<span className="str">&quot;Blast off! 🚀&quot;</span>)</div>
                  <div className="line"> </div>
                  <div className="out"><div className="out-label">What it shows</div>3<br />2<br />1<br />Blast off! 🚀</div>
                </div>
              </div>
            </div>
            <img className="ada" src="/img/ada.webp" alt="Ada, a smiling girl with round glasses, waving" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>Meet your coding friends</h2>
            <p>Three friends keep your child company in every lesson, so learning to code never feels lonely or scary.</p>
          </div>
          <div className="friends">
            <div className="friend friend-ada">
              <div className="pic"><img src="/img/ada.webp" alt="Ada waving" /></div>
              <h3>Ada</h3>
              <p className="role">Your guide</p>
              <p>Ada explains each new idea in short, simple sentences and sets a small challenge to try.</p>
            </div>
            <div className="friend friend-byte">
              <div className="pic"><img src="/img/byte.webp" alt="Byte, a white owl with big glasses and a blue coding hoodie" /></div>
              <h3>Byte the owl</h3>
              <p className="role">The helper</p>
              <p>Stuck? Byte gives a hint, and when code goes wrong he explains the bug in words kids understand.</p>
            </div>
            <div className="friend friend-twinkle">
              <div className="pic"><img src="/img/twinkle.webp" alt="Twinkle, a fairy with a star wand" /></div>
              <h3>Twinkle</h3>
              <p className="role">The star giver</p>
              <p>Every time a challenge is solved, Twinkle flies in with a shiny star to celebrate.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-lilac" id="lessons">
        <div className="wrap">
          <div className="section-head">
            <h2>What your child will learn</h2>
            <p>Lessons with examples and videos that build on each other, from a first hello to loops, lists and even teaching the computer to see with OpenCV. New lessons arrive in the app automatically.</p>
          </div>
          <div className="path">
            <div className="level">
              <span className="lv">Level 1</span>
              <h3>First steps</h3>
              <p>Meet Python and make the computer say hello, print fun messages and leave secret notes in code.</p>
              <p className="makes"><b>They&apos;ll make:</b> A hello card for friends</p>
            </div>
            <div className="level">
              <span className="lv">Level 2</span>
              <h3>Boxes and data</h3>
              <p>Store names and numbers in variables, do quick maths and play with words.</p>
              <p className="makes"><b>They&apos;ll make:</b> A pocket calculator</p>
            </div>
            <div className="level">
              <span className="lv">Level 3</span>
              <h3>Choices and loops</h3>
              <p>Ask questions, make decisions, and let loops repeat things all by themselves.</p>
              <p className="makes"><b>They&apos;ll make:</b> A quiz and a rocket countdown</p>
            </div>
            <div className="level">
              <span className="lv">Level 4</span>
              <h3>Bigger adventures</h3>
              <p>Create your own commands, keep lists of things and give the computer robot eyes.</p>
              <p className="makes"><b>They&apos;ll make:</b> A photo flipper</p>
            </div>
          </div>
          <p className="path-note">
            Every lesson comes with a short video, six worked examples to try, and a code editor where children run their own programs and see the results straight away.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="steps-head">
            <div className="section-head">
              <h2>Up and coding in three steps</h2>
              <p>A grown-up sets things up once, which takes about five minutes. After that, your child can open the app and carry on by themselves, at their own pace, whenever they like.</p>
            </div>
            <div className="byte-helper">
              <p className="byte-bubble">Hoo! Setting up is easy. I&apos;ll be right here if your coder gets stuck.</p>
              <img src="/img/byte.webp" alt="Byte the owl waving" />
            </div>
          </div>
          <ol className="steps">
            <li>
              <h3>Make a parent account</h3>
              <p>It only takes your name, your email and a password. Your child doesn&apos;t need an account or an email address. You can add their first name too, so we can greet them.</p>
            </li>
            <li>
              <h3>Install the app</h3>
              <p>Download Ada The Coder for Windows or Mac from your account page and install it like any other program. After that, it works even without the internet.</p>
            </li>
            <li>
              <h3>Let them create</h3>
              <p>Each lesson starts with a short video, then examples to click, run and change. When the code works there&apos;s a big celebration, and when something goes wrong, a friendly message shows how to fix it.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section section-mint" id="parents">
        <div className="wrap parents">
          <div>
            <h2>Made with parents in mind</h2>
            <p>{s.parents_note}</p>
            <p>Children aged 6 and 7 learn best with a grown-up sitting next to them for the first few lessons. Most 8 to 11 year olds can work through them on their own.</p>
            <div className="byte-tip">
              <img src="/img/byte.webp" alt="" />
              <p>Hoo! When code breaks, I explain what happened and how to fix it.</p>
            </div>
          </div>
          <ul className="facts">
            <li><span className="tick" aria-hidden="true">✓</span><span><b>Real Python, not blocks.</b> Children type the same language professional programmers use, one small step at a time.</span></li>
            <li><span className="tick" aria-hidden="true">✓</span><span><b>Friendly error messages.</b> When code breaks, Byte explains what went wrong in words a child understands.</span></li>
            <li><span className="tick" aria-hidden="true">✓</span><span><b>Works offline.</b> After installing, the app works without the internet. It checks for new lessons when it can.</span></li>
            <li><span className="tick" aria-hidden="true">✓</span><span><b>Nothing to manage.</b> New lessons and updates are delivered to the app you&apos;ve already installed.</span></li>
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
          <div className="section-head"><h2>Questions from parents</h2></div>
          <div className="faq">
            <div className="faq-col">
              <details>
                <summary>My child has never coded. Is that OK?</summary>
                <p>Yes. The first lesson starts with one line of code, and every lesson explains new words before using them.</p>
              </details>
              <details>
                <summary>Does my child need to be good at reading?</summary>
                <p>Lessons use short sentences and big text. Younger children who are still learning to read will enjoy it most with a grown-up reading alongside them.</p>
              </details>
              <details>
                <summary>How long does a lesson take?</summary>
                <p>Each lesson is short: a video and a handful of small examples. Most children can finish one in a single sitting, and they can always stop and pick up where they left off.</p>
              </details>
            </div>
            <div className="faq-col">
              <details>
                <summary>Which computers does it work on?</summary>
                <p>Windows 10 or 11, and Mac computers running macOS 11 or newer. iPads, iPhones and Chromebooks aren&apos;t supported yet.</p>
              </details>
              <details>
                <summary>What information do you keep about my child?</summary>
                <p>Only what you choose to tell us when signing up: an optional first name and age. Your child&apos;s code and progress stay on your computer. Read the <Link href="/privacy">privacy page</Link> for details.</p>
              </details>
              <details>
                <summary>How do updates work?</summary>
                <p>New lessons and videos download into the app by themselves. When a new version of the app is ready, the app shows a message and a grown-up can download it from this website.</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="wrap">
          <div className="cta-band">
            <img src="/img/twinkle.webp" alt="" />
            <h2>Ready for the first line of code?</h2>
            <Link className="btn btn-sun" href={user ? '/account' : '/register'}>{user ? 'Go to downloads' : 'Try For Free!'}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
