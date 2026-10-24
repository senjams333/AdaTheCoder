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

const codeBox = (code: string) =>
  `<div style="margin:0 0 18px;text-align:center;"><span style="display:inline-block;background:#F4F1FF;border:2px dashed #7B4DFF;border-radius:16px;padding:12px 26px;font-size:32px;font-weight:bold;letter-spacing:10px;color:#2B2257;font-family:Consolas,monospace;">${esc(code)}</span></div>`;

/** Sent when a parent signs up on the website: the link opens the website, where they type the code. */
export function signupCodeEmail(user: { name: string; email: string }, link: string, code: string, siteUrl: string): Email {
  const first = (user.name || '').split(' ')[0] || 'there';
  const html = layout(
    'Your Ada The Coder code',
    `<h1 style="margin:0 0 12px;font-size:24px;color:#2B2257;">Hi ${esc(first)}, one last step! 🎉</h1>
<p style="margin:0 0 14px;">To finish making your Ada The Coder account for <b>${esc(user.email)}</b>, press the button and type this code:</p>
${codeBox(code)}
<p style="margin:0 0 18px;text-align:center;">${button(link, 'Finish my account')}</p>
<p style="margin:0 0 14px;font-size:14px;">The code works for 30 minutes. Your account is made when you type it.</p>
<p style="margin:0;color:#6B6890;font-size:14px;">Didn't sign up? Ignore this email: nothing is made without the code.</p>`,
    siteUrl,
  );
  const text = `Hi ${first},

To finish making your Ada The Coder account for ${user.email}, open this link and type the code:

Code: ${code}
${link}

The code works for 30 minutes. Didn't sign up? Ignore this email.`;
  return { subject: `Your Ada The Coder code: ${code}`, html, text };
}

/** Sent when someone asks for a new password on the website (or from the app's Profile → Change password). */
export function passwordResetEmail(user: { name: string; email: string }, link: string, code: string, siteUrl: string): Email {
  const first = (user.name || '').split(' ')[0] || 'there';
  const forgot = `${siteUrl.replace(/\/$/, '')}/forgot-password`;
  const html = layout(
    'Choose a new password',
    `<h1 style="margin:0 0 12px;font-size:24px;color:#2B2257;">Hi ${esc(first)}, here's your link 🔑</h1>
<p style="margin:0 0 14px;">Someone asked to change the password of the Ada The Coder account <b>${esc(user.email)}</b>.
Press the button, type this code, and choose a new one. It works for the website and the app.</p>
${codeBox(code)}
<p style="margin:0 0 18px;text-align:center;">${button(link, 'Choose a new password')}</p>
<p style="margin:0 0 14px;font-size:14px;">The link works for 1 hour, and only once. If it has expired, ask for a new one at
<a href="${esc(forgot)}" style="color:#7B4DFF;">${esc(forgot.replace(/^https?:\/\//, ''))}</a>.</p>
<p style="margin:0;color:#6B6890;font-size:14px;">Didn't ask for this? Ignore this email: your password stays the same.</p>`,
    siteUrl,
  );
  const text = `Hi ${first},

Someone asked to change the password of the Ada The Coder account ${user.email}.
Open this link, type the code, and choose a new password (it works for the website and the app):

Code: ${code}
${link}

The link works for 1 hour, and only once. A new one: ${forgot}

Didn't ask for this? Ignore this email: your password stays the same.`;
  return { subject: `Your Ada The Coder password code: ${code}`, html, text };
}
