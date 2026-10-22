// Fills a fresh API with demo content, then screenshots every page of the website and admin.
// Used by the "Preview" GitHub workflow:  node e2e/screens.mjs http://127.0.0.1:5000 http://127.0.0.1:3000/api shots
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { chromium } from 'playwright';

const [WEB = 'http://127.0.0.1:5000', API = 'http://127.0.0.1:3000/api', OUT = 'shots'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const json = { 'content-type': 'application/json' };
const call = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path}: ${res.status} ${JSON.stringify(body)}`);
  return body;
};

// ---- demo content
const admin = await call('/auth/setup', { method: 'POST', headers: json, body: JSON.stringify({ name: 'Senjam SD', email: 'admin@adathecoder.com', password: 'demo-admin-password' }) });
const auth = { authorization: `Bearer ${admin.token}` };
const form = new FormData();
for (const [k, v] of Object.entries({
  name: 'Learn Coding in Space', slug: 'space', pack: 'custom', premium: 'true', price: '$2.99', freeLessons: '3', position: '4',
  published: 'true', copyFrom: '1', tagline: 'Blast off and learn Python among the stars with Astro, Comet and Nova.',
  features: 'Astro guides every mission\nComet cheers when code works\nAll 17 beginner lessons',
  charName0: 'Astro', charName1: 'Comet', charName2: 'Nova',
})) form.append(k, v);
['astro', 'comet', 'nova'].forEach((n, i) => form.append(`charFile${i}`, new Blob([readFileSync(`e2e/assets/${n}.png`)], { type: 'image/png' }), `${n}.png`));
const space = await call('/admin/themes', { method: 'POST', headers: auth, body: form });
const themeDetail = await call(`/admin/themes/${space.id}`, { headers: auth });
const parent = await call('/auth/register', { method: 'POST', headers: json, body: JSON.stringify({
  name: 'Priya Sharma', email: 'priya.sharma@example.com', password: 'goodpass1', city: 'Imphal', country: 'India', childName: 'Mira', childAge: 8, consent: true,
}) });
for (const [n, e, c] of [['Ravi Kumar', 'ravi@example.com', 'Chennai'], ['Lina Devi', 'lina@example.com', 'Goa']]) {
  await call('/auth/register', { method: 'POST', headers: json, body: JSON.stringify({ name: n, email: e, password: 'goodpass1', city: c, country: 'India', consent: true }) });
}
const parents = await call('/admin/parents', { headers: auth });
const friends = parents.paidThemes.find((t) => t.slug === 'friends');
await call(`/admin/parents/${parents.parents.find((p) => p.email === 'priya.sharma@example.com').id}/plan`, {
  method: 'PUT', headers: { ...auth, ...json }, body: JSON.stringify({ plan: 'premium', licences: { [friends.id]: 'ADA-FRND-7Q4K-9M2P' } }),
});
const release = new FormData();
for (const [k, v] of Object.entries({ platform: 'windows', version: '1.2.0', notes: 'Themes, Try free and Upgrade.', makeLatest: 'true' })) release.append(k, v);
release.append('file', new Blob([Buffer.alloc(1024 * 1024)]), 'AdaTheCoder-1.2.0-Windows-Setup.exe');
await call('/admin/releases', { method: 'POST', headers: auth, body: release });

// ---- screenshots
const browser = await chromium.launch();
const shots = [];
async function shoot(name, path, who, { width = 1366, height = 900, full = true, before } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (who) {
    await context.addInitScript((v) => localStorage.setItem('ada.auth', v), JSON.stringify({ token: who.token, user: who.user }));
  }
  const page = await context.newPage();
  await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (before) await before(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  shots.push({ name, path, width });
  console.log('shot', name, path);
  await context.close();
}

const lessonId = themeDetail.lessons[1].id;
await shoot('home', '/', null);
await shoot('register', '/register', null);
await shoot('login', '/login', null);
await shoot('privacy', '/privacy', null);
await shoot('account', '/account', parent, { full: false });
await shoot('account-install', '/account', parent, { full: false, before: async (p) => { await p.getByRole('button', { name: 'How to install', exact: true }).click(); await p.waitForTimeout(500); } });
await shoot('admin-login', '/admin/login', null);
await shoot('admin', '/admin', admin);
await shoot('admin-content', '/admin/content', admin);
await shoot('admin-themes', '/admin/themes', admin);
await shoot('admin-theme', `/admin/themes/${space.id}`, admin);
await shoot('admin-theme-settings', `/admin/themes/${space.id}/settings`, admin);
await shoot('admin-lesson', `/admin/lessons/${lessonId}`, admin);
await shoot('admin-releases', '/admin/releases', admin);
await shoot('admin-parents', '/admin/parents', admin);
await shoot('home-phone', '/', null, { width: 390, height: 844 });
await shoot('account-phone', '/account', parent, { width: 390, height: 844 });
writeFileSync(`${OUT}/index.json`, JSON.stringify(shots, null, 1));
await browser.close();
