// Screenshots of every page of the running website (after smoke.mjs has filled in some data).
//   node e2e/screens.mjs <web url> <api url> <output folder>
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const [WEB, API, OUT] = [process.argv[2], process.argv[3], process.argv[4] || 'shots'];
mkdirSync(OUT, { recursive: true });

async function logIn(email, password) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return r.json();
}
const admin = await logIn('boss@example.com', 'a-long-password');
const parent = await logIn('priya@example.com', 'goodpass1');
const themes = await (await fetch(`${API}/admin/themes`, { headers: { authorization: `Bearer ${admin.token}` } })).json();
const jungle = themes.find((t) => t.slug === 'jungle') || themes[0];
const detail = await (await fetch(`${API}/admin/themes/${jungle.id}`, { headers: { authorization: `Bearer ${admin.token}` } })).json();
const lessonId = detail.lessons[0].id;

const browser = await chromium.launch();
async function shoot(name, path, who, { width = 1366, height = 900, full = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  if (who) await ctx.addInitScript((v) => localStorage.setItem('ada.auth', v), JSON.stringify({ token: who.token, user: who.user }));
  const page = await ctx.newPage();
  await page.goto(WEB + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await ctx.close();
  console.log('shot', name);
}

await shoot('01-home', '/', null);
await shoot('02-register', '/register', null);
await shoot('03-login', '/login', null);
await shoot('04-account', '/account', parent, { full: false });
await shoot('05-admin-overview', '/admin', admin);
await shoot('06-admin-text', '/admin/content', admin);
await shoot('07-admin-themes', '/admin/themes', admin);
await shoot('08-admin-theme', `/admin/themes/${jungle.id}`, admin);
await shoot('09-admin-theme-settings', `/admin/themes/${jungle.id}/settings`, admin);
await shoot('10-admin-lesson', `/admin/lessons/${lessonId}`, admin);
await shoot('11-admin-versions', '/admin/releases', admin);
await shoot('12-admin-parents', '/admin/parents', admin);
await shoot('13-admin-login', '/admin/login', null);
await shoot('14-home-phone', '/', null, { width: 390, height: 844 });
await shoot('15-account-phone', '/account', parent, { width: 390, height: 844 });
await browser.close();
