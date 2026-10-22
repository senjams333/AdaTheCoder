'use client';

import { useEffect, useState } from 'react';

/** The step-by-step install guide (Windows and Mac tabs). Opens on the tab for this computer. */
export default function InstallHelp({ contact, onDone }: { contact: string; onDone: () => void }) {
  const [tab, setTab] = useState<'windows' | 'mac'>('windows');
  useEffect(() => {
    if (/Macintosh|Mac OS X/i.test(navigator.userAgent)) setTab('mac');
  }, []);
  return (
    <>
      <p className="acct-text install-intro">About 5 minutes, and you only do it once. New lessons then arrive by themselves.</p>
      <div className="install-tabs" role="tablist">
        {(['windows', 'mac'] as const).map((t) => (
          <button key={t} type="button" role="tab" className="install-tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'windows' ? 'Windows' : 'Mac'}
          </button>
        ))}
      </div>
      {tab === 'windows' ? (
        <div className="install-pane">
          <p className="install-need">💻 Windows 10 or 11 · about 500 MB free</p>
          <ol className="install-steps-list">
            <li className="step"><span className="step-num">1</span><div className="step-body"><h3>Download the installer</h3><p>Click <b>⬇ Windows</b> on the Free Trial card. The file <b>AdaTheCoder Setup</b> saves to your Downloads folder.</p></div></li>
            <li className="step"><span className="step-num">2</span><div className="step-body"><h3>Open the file</h3><p>Double-click <b>AdaTheCoder Setup</b> to start.</p><p className="step-tip">If a blue box says <b>“Windows protected your PC”</b>, click <b>More info</b> → <b>Run anyway</b>. If asked to allow changes, click <b>Yes</b>.</p></div></li>
            <li className="step"><span className="step-num">3</span><div className="step-body"><h3>Follow the installer</h3><p>Click <b>Next</b>, tick <b>Create a desktop shortcut</b>, then <b>Install</b> and <b>Finish</b>.</p></div></li>
            <li className="step"><span className="step-num">4</span><div className="step-body"><h3>Start coding!</h3><p>Open <b>Ada The Coder</b> from the desktop or Start menu and begin the first lesson.</p></div></li>
          </ol>
        </div>
      ) : (
        <div className="install-pane">
          <p className="install-need">🍎 macOS 11 (Big Sur) or newer · about 500 MB free</p>
          <ol className="install-steps-list">
            <li className="step"><span className="step-num">1</span><div className="step-body"><h3>Download the app</h3><p>Click <b>⬇ Mac</b> on the Free Trial card. A <b>.dmg</b> file saves to your Downloads folder.</p></div></li>
            <li className="step"><span className="step-num">2</span><div className="step-body"><h3>Drag to Applications</h3><p>Double-click the file, then drag the <b>Ada The Coder</b> icon onto the <b>Applications</b> folder.</p></div></li>
            <li className="step"><span className="step-num">3</span><div className="step-body"><h3>Open it the first time</h3><p>In Applications, <b>right-click</b> Ada The Coder → <b>Open</b> → <b>Open</b>.</p><p className="step-tip">Still blocked? Go to <b>System Settings → Privacy &amp; Security</b> and click <b>Open Anyway</b>.</p></div></li>
            <li className="step"><span className="step-num">4</span><div className="step-body"><h3>Keep it handy</h3><p>Right-click the icon in the Dock → <b>Options</b> → <b>Keep in Dock</b>, so your child can find it again.</p></div></li>
          </ol>
        </div>
      )}
      <p className="install-help">Stuck? Email <a href={`mailto:${contact}`}>{contact}</a> and we&apos;ll help you get set up.</p>
      <div className="acct-modal-buttons"><button type="button" className="acct-btn" onClick={onDone}>Got it</button></div>
    </>
  );
}
