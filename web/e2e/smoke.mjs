// Clicks through the website and admin in a real browser, against a running API + MySQL.
// Used by the "End-to-end" GitHub check:  node e2e/smoke.mjs http://127.0.0.1:5000 http://127.0.0.1:3000/api
import { chromium } from 'playwright';

const WEB = process.argv[2] || 'http://127.0.0.1:5000';
const API = process.argv[3] || 'http://127.0.0.1:3000/api';
const results = [];
let page;

async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
    console.log(`PASS ${name}`);
  } catch (err) {
    const text = page ? (await page.locator('body').innerText().catch(() => '')).slice(0, 1500) : '';
    const msg = `FAIL ${name}: ${err.message.split('\n')[0]}\n  at ${page?.url()}\n  page text: ${text.replace(/\s+/g, ' ')}`;
    results.push(msg);
    console.log(msg);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`${page.url()}: ${e.message}`));

await step('home page shows the headline from the API', async () => {
  await page.goto(WEB);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByText("first lines of real code").first().waitFor({ timeout: 15000 });
});

await step('first visit to the admin creates the admin account', async () => {
  await page.goto(`${WEB}/admin/login`);
  await page.getByRole('heading', { name: 'Create the admin account' }).waitFor({ timeout: 15000 });
  await page.fill('#name', 'Sen');
  await page.fill('#email', 'boss@example.com');
  await page.fill('#password', 'a-long-password');
  await page.fill('#password2', 'a-long-password');
  await page.getByRole('button', { name: 'Create admin account' }).click();
  await page.getByRole('heading', { name: 'Overview' }).waitFor({ timeout: 15000 });
  await page.getByText('parent accounts').waitFor();
});

await step('website text: change the headline', async () => {
  await page.getByRole('link', { name: 'Website text' }).click();
  await page.locator('#hero_title').waitFor();
  await page.fill('#hero_title', 'Coding is an adventure');
  await page.getByRole('button', { name: 'Save website text' }).click();
  await page.getByText('Website text saved').waitFor({ timeout: 15000 });
});

let themeUrl = '';
await step('themes: 3 built-in themes, add a new one (lessons copied)', async () => {
  await page.getByRole('link', { name: 'Themes & lessons' }).click();
  await page.getByRole('heading', { name: 'Themes' }).waitFor();
  await page.getByText('Friends Adventure').first().waitFor();
  await page.getByRole('link', { name: '+ Add a theme' }).click();
  await page.fill('#name', 'Jungle Coders');
  await page.fill('#slug', 'jungle');
  await page.fill('#tagline', 'Swing through the trees with Python.');
  await page.getByRole('button', { name: 'Add theme' }).click();
  await page.getByText('Lessons in this theme').waitFor({ timeout: 20000 });
  await page.getByText("Theme 'Jungle Coders' added with 17 lessons copied.").waitFor();
  themeUrl = page.url();
});

await step('lesson editor: rename a topic, it shows in the theme', async () => {
  await page.getByRole('link', { name: 'Edit' }).nth(1).click();
  await page.locator('#name').waitFor({ timeout: 15000 });
  await page.fill('#emoji', '🐒');
  await page.fill('#name', 'PRINT IN THE JUNGLE');
  await page.getByRole('button', { name: 'Save lesson' }).click();
  await page.getByText('Lessons in this theme').waitFor({ timeout: 15000 });
  await page.getByRole('link', { name: 'PRINT IN THE JUNGLE' }).waitFor();
});

await step('lesson order: move the renamed topic to the top', async () => {
  await page.getByTitle('Move up').nth(1).click();
  await page.waitForFunction(() => document.querySelector('tbody tr td:nth-child(2)')?.textContent?.includes('PRINT IN THE JUNGLE'), null, { timeout: 15000 });
});

await step('the desktop app feed has the new theme and topic', async () => {
  const res = await (await fetch(`${API}/v3/courses`)).json();
  const jungle = res.courses.find((c) => c.id === 'jungle');
  if (!jungle) throw new Error('jungle missing from /v3/courses');
  if (jungle.lessons[0].name !== 'PRINT IN THE JUNGLE') throw new Error(`first lesson is ${jungle.lessons[0].name}`);
});

await step('theme settings: make it paid with 2 free lessons', async () => {
  await page.goto(themeUrl);
  await page.getByRole('link', { name: 'Theme settings' }).click();
  await page.locator('#price').waitFor({ timeout: 15000 });
  await page.getByLabel('Paid theme', { exact: false }).check();
  await page.fill('#price', '$1.99');
  await page.fill('#free_lessons', '2');
  await page.getByRole('button', { name: 'Save theme' }).click();
  await page.getByText('$1.99 · first 2 lessons free').waitFor({ timeout: 15000 });
});

await step('log out; the home page shows the new headline', async () => {
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByText('Coding is an adventure').first().waitFor({ timeout: 15000 });
});

await step('a parent signs up and lands on the account page', async () => {
  await page.goto(`${WEB}/register`);
  await page.fill('#name', 'Priya Sharma');
  await page.fill('#email', 'priya@example.com');
  await page.fill('#city', 'Imphal');
  await page.fill('#country', 'India');
  await page.fill('#password', 'goodpass1');
  await page.fill('#password2', 'goodpass1');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByText('Welcome, Priya!').waitFor({ timeout: 20000 });
  await page.getByText('Jungle Coders').first().waitFor();
  await page.getByText('Your account is ready').waitFor();
});

await step('account: edit details in the pop-up', async () => {
  await page.getByRole('button', { name: 'Edit Details' }).click();
  await page.fill('#d_city', 'Pune');
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.getByText('Your details are saved.').waitFor({ timeout: 15000 });
  await page.locator('.acct-value', { hasText: 'Pune' }).waitFor();
});

await step('admin gives the parent a licence; the app log-in unlocks the theme', async () => {
  const login = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'boss@example.com', password: 'a-long-password' }) })).json();
  const auth = { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' };
  const data = await (await fetch(`${API}/admin/parents`, { headers: auth })).json();
  const priya = data.parents.find((p) => p.email === 'priya@example.com');
  const jungle = data.paidThemes.find((t) => t.slug === 'jungle');
  await fetch(`${API}/admin/parents/${priya.id}/plan`, { method: 'PUT', headers: auth, body: JSON.stringify({ plan: 'premium', licences: { [jungle.id]: 'ADA-JUNGLE-1' } }) });
  const app = await (await fetch(`${API}/v3/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'priya@example.com', password: 'goodpass1' }) })).json();
  if (!app.licences?.includes('jungle')) throw new Error(`app log-in answered ${JSON.stringify(app)}`);
  await page.reload();
  await page.getByText('ADA-JUNGLE-1').waitFor({ timeout: 15000 });
});

await step('parents can not open the admin', async () => {
  await page.goto(`${WEB}/admin`);
  await page.waitForURL(/\/admin\/login/, { timeout: 15000 });
});

await step('no JavaScript errors on any page', async () => {
  if (consoleErrors.length) throw new Error(consoleErrors.join(' | '));
});

await browser.close();
const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
