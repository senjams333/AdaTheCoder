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
  const mac = Boolean(data?.releases?.mac);      // a Mac version is uploaded (until then: "Mac coming soon")
  const paragraphs = (s.author_note || '').split('\n\n').map((p) => p.trim()).filter(Boolean);
  // the app's break reminder, as the admin set it (0 = off); parents are told about it below
  const breakN = Number.parseInt(s.break_minutes ?? '30', 10);
  const breakMinutes = Number.isNaN(breakN) ? 30 : Math.max(0, breakN);

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
                <div className="screen">
                  <div className="bar"><span>stars.py</span><span className="run">▶ Run</span></div>
                  <div className="line"><span className="kw">for</span> count_star <span className="kw">in</span> <span className="fn">range</span>(<span className="num">3</span>):</div>
                  <div className="line">{'    '}<span className="fn">print</span>(<span className="str">&quot;Golden star ⭐&quot;</span>)</div>
                  <div className="line"> </div>
                  <div className="line"> </div>
                  <div className="out"><div className="out-label">What it shows</div>Golden star ⭐<br />Golden star ⭐<br />Golden star ⭐<br /><span className="cursor" aria-hidden="true" /></div>
                </div>
              </div>
            </div>
            <img className="ada" src="/img/ada.webp" alt="Ada, a smiling girl with round glasses, waving" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head wide">
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
            <div className="friend friend-tom">
              <div className="pic"><img src="/img/tom-friend.webp" alt="Tom, a smiling boy in a blue hoodie, waving" /></div>
              <h3>Tom</h3>
              <p className="role">The cheer &amp; fix-it buddy</p>
              <p>When the code works, Tom cheers with a big wave. When something goes wrong, he pops up to show what to fix.</p>
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
              <p>Meet Python, make the computer say hello, print fun messages with emojis and leave secret notes that only coders can read.</p>
              <p className="makes"><b>They&apos;ll make:</b> A hello card for friends</p>
            </div>
            <div className="level">
              <span className="lv">Level 2</span>
              <h3>Boxes and data</h3>
              <p>Store names and numbers in variables like labelled boxes, do quick maths, and join words together to build fun sentences.</p>
              <p className="makes"><b>They&apos;ll make:</b> A pocket calculator</p>
            </div>
            <div className="level">
              <span className="lv">Level 3</span>
              <h3>Choices and loops</h3>
              <p>Ask the player questions, let the program make decisions with if and else, and use loops to repeat things automatically.</p>
              <p className="makes"><b>They&apos;ll make:</b> A quiz and a rocket countdown</p>
            </div>
            <div className="level">
              <span className="lv">Level 4</span>
              <h3>Bigger adventures</h3>
              <p>Create your own commands with functions, keep lists of favourite things, fix errors calmly and even give the computer robot eyes.</p>
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
              <p className="byte-bubble">Hoo! Setting up takes just a few minutes. Watch our step-by-step installation tutorial{' '}
                <a href={s.install_video_url || '#'} target={s.install_video_url ? '_blank' : undefined} rel="noopener noreferrer">here</a>.</p>
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
              <p>Download Ada The Coder for {mac ? 'Windows or Mac' : 'Windows (Mac coming soon)'} from your account page and install it like any other program. After that, it works even without the internet.</p>
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
            {breakMinutes > 0 && (
              <li><span className="tick" aria-hidden="true">✓</span><span><b>Healthy screen breaks.</b> After {breakMinutes} minutes of active coding, the app pauses for &quot;The Quick Reset&quot;: rest the eyes, stretch, breathe and drink some water. Only real use counts, so time away from the screen doesn&apos;t.</span></li>
            )}
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
              <details>
                <summary>What if my child gets stuck?</summary>
                <p>Every lesson has six worked examples to try before writing their own code. When something goes wrong, Byte the owl explains what happened and how to fix it in simple words, and the lesson video can be watched again at any time with the See video button.</p>
              </details>
            </div>
            <div className="faq-col">
              <details>
                <summary>Which computers does it work on?</summary>
                <p>{mac ? 'Windows 10 or 11, and Mac computers running macOS 11 or newer.' : 'Windows 10 or 11. The Mac version is coming soon.'} iPads, iPhones and Chromebooks aren&apos;t supported yet.</p>
              </details>
              <details>
                <summary>What information do you keep about my child?</summary>
                <p>Only what you choose to tell us when signing up: an optional first name and age. Your child&apos;s code and progress stay on your computer. Read the <Link href="/privacy">privacy page</Link> for details.</p>
              </details>
              {breakMinutes > 0 && (
                <details>
                  <summary>Will my child stay on the screen too long?</summary>
                  <p>The app looks after this for you. After {breakMinutes} minutes of active use, it pauses the lesson and shows &quot;The Quick Reset&quot;, a short break in four steps: look at something far away to rest the eyes, do a few star-jumps or stretches, take three slow balloon breaths, and drink some water.</p>
                  <p>Only real use counts: typing code, clicking, moving the mouse or watching a lesson video. If your child leaves the computer, the count pauses, and after 10 minutes away it starts again from zero, because that was already a break.</p>
                </details>
              )}
              <details>
                <summary>How do updates work?</summary>
                <p>New lessons and videos download into the app by themselves. When a new version of the app is ready, the app shows a message and a grown-up can download it from this website.</p>
              </details>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
