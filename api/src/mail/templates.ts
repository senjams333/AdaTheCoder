/** Email templates for new accounts. Inline styles only, because email programs ignore <style> blocks. */

export interface NewAccount {
  name: string;
  email: string;
  city?: string;
  country?: string;
  childName?: string | null;
  childAge?: number | null;
  createdAt?: Date;
}

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function layout(title: string, body: string, siteUrl: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F4F1FF;font-family:'Segoe UI',Arial,sans-serif;color:#1E1B4B;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1FF;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 8px 24px rgba(43,34,87,.12);">
<tr><td style="background:#2B2257;padding:22px 28px;">
  <span style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#FFD23F;text-align:center;line-height:36px;font-size:20px;vertical-align:middle;">🐍</span>
  <span style="color:#FFFFFF;font-size:20px;font-weight:bold;vertical-align:middle;margin-left:10px;">Ada The Coder</span>
</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.6;">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#FAF8FF;color:#6B6890;font-size:12px;line-height:1.5;">
  Python lessons for children aged 6 to 11 · <a href="${esc(siteUrl)}" style="color:#7B4DFF;">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#FFD23F;color:#1E1B4B;text-decoration:none;font-weight:bold;padding:13px 28px;border-radius:999px;border-bottom:3px solid #F2B500;">${esc(label)}</a>`;

/** Sent to the parent who just made an account. */
export function welcomeEmail(user: NewAccount, siteUrl: string): Email {
  const first = (user.name || '').split(' ')[0] || 'there';
  const child = user.childName ? esc(user.childName) : 'your child';
  const account = `${siteUrl.replace(/\/$/, '')}/account`;
  const html = layout(
    'Welcome to Ada The Coder',
    `<h1 style="margin:0 0 12px;font-size:24px;color:#2B2257;">Welcome, ${esc(first)}! 🎉</h1>
<p style="margin:0 0 14px;">Your Ada The Coder account is ready. ${child === 'your child' ? 'Your child' : child} can start learning Python today, one small step at a time.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#F4F1FF;border-radius:16px;width:100%;">
<tr><td style="padding:16px 18px;font-size:15px;">
  <b>What to do next</b><br>
  1. Open your account page and download the app for Windows or Mac.<br>
  2. Log in to the app with this email: <b>${esc(user.email)}</b><br>
  3. Pick a theme and press <b>Try free</b>.
</td></tr></table>
<p style="margin:0 0 22px;">${button(account, 'Go to my account')}</p>
<p style="margin:0;color:#6B6890;font-size:14px;">Didn't make this account? Just ignore this email, or reply and we'll remove it.</p>`,
    siteUrl,
  );
  const text = `Welcome, ${first}!

Your Ada The Coder account is ready.

What to do next:
1. Open your account page and download the app: ${account}
2. Log in to the app with this email: ${user.email}
3. Pick a theme and press Try free.

Didn't make this account? Ignore this email, or reply and we'll remove it.`;
  return { subject: 'Welcome to Ada The Coder! 🐍 Your account is ready', html, text };
}

/** Sent to the admin when a parent makes an account. */
export function adminNewAccountEmail(user: NewAccount, siteUrl: string): Email {
  const when = (user.createdAt ?? new Date()).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const rows: [string, string][] = [
    ['Name', user.name],
    ['Email', user.email],
    ['City', user.city || '–'],
    ['Country', user.country || '–'],
    ['Child', user.childName ? `${user.childName}${user.childAge ? `, age ${user.childAge}` : ''}` : '–'],
    ['Signed up', when],
  ];
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:7px 14px 7px 0;color:#6B6890;white-space:nowrap;">${esc(k)}</td><td style="padding:7px 0;font-weight:bold;">${esc(v)}</td></tr>`)
    .join('');
  const html = layout(
    'New parent account',
    `<h1 style="margin:0 0 12px;font-size:22px;color:#2B2257;">New parent account 👋</h1>
<p style="margin:0 0 14px;">Someone just signed up for Ada The Coder.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;">${table}</table>
<p style="margin:0;">${button(`${siteUrl.replace(/\/$/, '')}/admin/parents`, 'Open Parents in the admin')}</p>`,
    siteUrl,
  );
  const text = `New parent account\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nAdmin: ${siteUrl.replace(/\/$/, '')}/admin/parents`;
  return { subject: `New parent account: ${user.name} (${user.email})`, html, text };
}
