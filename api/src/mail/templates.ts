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
  /** Where "Reply" goes (a contact message replies to the person who wrote it). */
  replyTo?: { email: string; name?: string };
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

export interface Purchase {
  name: string;
  email: string;
  theme: string;
  licence: string;
  amount: string;           // e.g. "₹299.00" or "USD 4.99"
  provider: string;         // Razorpay or PayPal
  reference: string;        // the payment's id at Razorpay or PayPal
  when?: Date;
}

/** Sent to the parent when a payment goes through: the theme is unlocked, with the licence code. */
export function licenceEmail(p: Purchase, siteUrl: string): Email {
  const site = siteUrl.replace(/\/$/, '');
  const box = `<div style="margin:0 0 18px;text-align:center;"><span style="display:inline-block;background:#ECFDF5;border:2px dashed #22C997;border-radius:16px;padding:12px 22px;font-size:22px;font-weight:bold;letter-spacing:2px;color:#2B2257;font-family:Consolas,monospace;">${esc(p.licence)}</span></div>`;
  const html = layout(
    'Your licence',
    `<h1 style="margin:0 0 12px;font-size:22px;color:#2B2257;">Thank you! ${esc(p.theme)} is unlocked 🎉</h1>
<p style="margin:0 0 14px;">Hi ${esc(p.name.split(' ')[0] || 'there')}, your payment of <b>${esc(p.amount)}</b> went through. Every lesson of <b>${esc(p.theme)}</b> is now open in the Ada The Coder app; it unlocks by itself within a minute.</p>
<p style="margin:0 0 8px;">Your licence:</p>${box}
<p style="margin:0 0 18px;font-size:14px;color:#6B6890;">Payment: ${esc(p.provider)} · reference ${esc(p.reference)}. Keep this email; the licence is also on your account page.</p>
<p style="margin:0 0 18px;">${button(`${site}/account`, 'Open my account')}</p>
<p style="margin:0;font-size:13px;color:#6B6890;">Charged twice or the theme didn't unlock? Just reply to this email and we'll make it right (<a href="${esc(site)}/privacy#purchases" style="color:#7B4DFF;">our policies</a>).</p>`,
    siteUrl,
  );
  const text = `Thank you! ${p.theme} is unlocked.\n\nPayment: ${p.amount} (${p.provider}, reference ${p.reference})\nYour licence: ${p.licence}\n\nEvery lesson is open in the Ada The Coder app. Your account: ${site}/account\nCharged twice or the theme didn't unlock? Reply to this email and we'll make it right. Our policies: ${site}/privacy#purchases`;
  return { subject: `Your Ada The Coder licence for ${p.theme}`, html, text };
}

/** Sent to the admin when a payment goes through. */
export function adminPaymentEmail(p: Purchase, siteUrl: string): Email {
  const rows: [string, string][] = [
    ['Parent', `${p.name} (${p.email})`], ['Theme', p.theme], ['Amount', p.amount], ['Paid with', p.provider],
    ['Reference', p.reference], ['Licence', p.licence], ['When', (p.when ?? new Date()).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
  ];
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:7px 14px 7px 0;color:#6B6890;white-space:nowrap;">${esc(k)}</td><td style="padding:7px 0;font-weight:bold;">${esc(v)}</td></tr>`)
    .join('');
  const html = layout('New payment', `<h1 style="margin:0 0 12px;font-size:22px;color:#2B2257;">New payment 💳</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;">${table}</table>
<p style="margin:0;">${button(`${siteUrl.replace(/\/$/, '')}/admin/parents`, 'Open Parents in the admin')}</p>`, siteUrl);
  const text = `New payment\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`;
  return { subject: `New payment: ${p.theme}, ${p.amount} (${p.email})`, html, text };
}

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** A message from the website's Contact page, sent to the admin. Replying answers the person who wrote it. */
export function contactEmail(m: ContactMessage, siteUrl: string): Email {
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const html = layout(
    'New message from the website',
    `<h1 style="margin:0 0 12px;font-size:22px;color:#2B2257;">New message ✉️</h1>
<p style="margin:0 0 6px;"><b>${esc(m.name)}</b> &lt;<a href="mailto:${esc(m.email)}" style="color:#7B4DFF;">${esc(m.email)}</a>&gt; wrote on the Contact page (${esc(when)}).</p>
<p style="margin:0 0 6px;"><b>Subject:</b> ${esc(m.subject)}</p>
<div style="margin:12px 0 18px;padding:14px 16px;background:#F4F1FF;border-radius:14px;white-space:pre-wrap;">${esc(m.message)}</div>
<p style="margin:0;color:#6B6890;font-size:14px;">Just press Reply to answer ${esc(m.name)}.</p>`,
    siteUrl,
  );
  const text = `New message from the Contact page\n\nFrom: ${m.name} <${m.email}>\nSubject: ${m.subject}\nSent: ${when}\n\n${m.message}\n`;
  return { subject: `Contact: ${m.subject} (${m.name})`, html, text, replyTo: { email: m.email, name: m.name } };
}
