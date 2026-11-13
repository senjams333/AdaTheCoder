/* Ada The Coder for Android and iOS (Flutter): the start page inside the app. It shows the Windows app's own screens
 * (desktop_app/assets/app, built by the app's own Python with Pyodide), scaled to fill the screen sideways, using the
 * same "window" as the website's /learn page (web/lib/appWindow.ts). The app's own server (lib/local_server.dart)
 * answers /api (the website, kept for offline use) and lets programs wait for input() answers. */
import { AppWindow, MIN_H, MIN_W } from '../../web/lib/appWindow';
import { PythonRunner } from '../../web/lib/python';

declare global { interface Window { flutter_inappwebview?: { callHandler: (name: string, ...args: unknown[]) => Promise<unknown> } } }

const SITE = 'https://www.adathecoder.com';
const frame = document.getElementById('app') as HTMLIFrameElement;
const wait = document.getElementById('wait') as HTMLDivElement;

// pages of the website (pay, account, forgot password) open in the phone's browser, never inside the app
window.open = ((url?: string | URL) => {
  const u = String(url || '');
  if (/^https?:/.test(u)) void window.flutter_inappwebview?.callHandler('openExternal', u);
  return null;
}) as typeof window.open;

function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.min(1, vw / MIN_W, vh / MIN_H);
  frame.style.width = `${Math.round(vw / s)}px`;
  frame.style.height = `${Math.round(vh / s)}px`;
  frame.style.transform = `scale(${s})`;
}
window.addEventListener('resize', fit);
fit();

const py = new PythonRunner(true);
py.viaServer = true;
const app = new AppWindow(py, '', (html) => { frame.srcdoc = html; }, { apiUrl: '/api', site: SITE, remember: true });
app.start().then(() => {
  frame.style.visibility = 'visible';
  wait.style.display = "none";
}, (e: Error) => {
  wait.querySelector('b')!.textContent = "Ada The Coder couldn't start.";
  wait.querySelector('small')!.textContent = `${e.message}. Connect to the internet the first time, then open the app again.`;
});
