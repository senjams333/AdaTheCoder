import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { adminNewAccountEmail, ContactMessage, contactEmail, adminPaymentEmail, Email, licenceEmail, NewAccount, passwordResetEmail, Purchase, signupCodeEmail, welcomeEmail } from './templates';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/** Sends emails through Brevo's transactional email API. */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get siteUrl(): string {
    return this.config.get<string>('SITE_URL', 'https://www.adathecoder.com');
  }

  /** The two account-creation emails: a welcome to the parent and a notice to the admin.
   *  Never throws: a mail problem must not stop the account from being created. */
  async sendAccountCreated(user: NewAccount): Promise<{ user: boolean; admin: boolean }> {
    const adminTo = this.config.get<string>('ADMIN_NOTIFY_EMAIL') || this.config.get<string>('BREVO_SENDER_EMAIL');
    const [toUser, toAdmin] = await Promise.all([
      this.send(user.email, user.name, welcomeEmail(user, this.siteUrl)),
      adminTo ? this.send(adminTo, 'Ada The Coder admin', adminNewAccountEmail(user, this.siteUrl)) : Promise.resolve(false),
    ]);
    return { user: toUser, admin: toAdmin };
  }

  /** After a payment: the licence to the parent, and a notice to the admin. Never throws. */
  async sendLicence(p: Purchase): Promise<void> {
    const adminTo = this.config.get<string>('ADMIN_NOTIFY_EMAIL') || this.config.get<string>('BREVO_SENDER_EMAIL');
    await Promise.all([
      this.send(p.email, p.name, licenceEmail(p, this.siteUrl)),
      adminTo ? this.send(adminTo, 'Ada The Coder admin', adminPaymentEmail(p, this.siteUrl)) : Promise.resolve(false),
    ]).catch(() => undefined);
  }

  /** The "choose a new password" email: a link and a 6-digit code. Never throws. */
  sendPasswordReset(user: { name: string; email: string }, token: string, code: string): Promise<boolean> {
    const link = `${this.siteUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    return this.send(user.email, user.name, passwordResetEmail(user, link, code, this.siteUrl));
  }

  /** The sign-up email: a link back to the website and a 6-digit code that makes the account. Never throws. */
  sendSignupCode(user: { name: string; email: string }, token: string, code: string): Promise<boolean> {
    const link = `${this.siteUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    return this.send(user.email, user.name, signupCodeEmail(user, link, code, this.siteUrl));
  }

  /** A Contact page message, to the admin (ADMIN_NOTIFY_EMAIL, else the contact email on the website, else the sender). */
  async sendContact(m: ContactMessage, contactAddress?: string): Promise<boolean> {
    const to = this.config.get<string>('ADMIN_NOTIFY_EMAIL') || contactAddress || this.config.get<string>('BREVO_SENDER_EMAIL');
    if (!to) return false;
    return this.send(to, 'Ada The Coder', contactEmail(m, this.siteUrl));
  }

  async send(toEmail: string, toName: string, email: Email): Promise<boolean> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const senderEmail = this.config.get<string>('BREVO_SENDER_EMAIL');
    if (!apiKey || !senderEmail) {
      this.log.warn(`Email to ${toEmail} not sent: set BREVO_API_KEY and BREVO_SENDER_EMAIL in .env`);
      return false;
    }
    try {
      const res = await fetch(BREVO_URL, {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: senderEmail, name: this.config.get<string>('BREVO_SENDER_NAME', 'Ada The Coder') },
          to: [{ email: toEmail, name: toName || toEmail }],
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
          ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        }),
      });
      if (!res.ok) {
        this.log.error(`Brevo refused the email to ${toEmail}: ${res.status} ${await res.text()}`);
        return false;
      }
      this.log.log(`Email "${email.subject.replace(/\b\d{6}\b/g, '******')}" sent to ${toEmail}`);   // codes aren't written to the logs
      return true;
    } catch (err) {
      this.log.error(`Couldn't reach Brevo to email ${toEmail}: ${(err as Error).message}`);
      return false;
    }
  }
}
