import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, HttpStatus, Ip, Post, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PACKS, PLATFORMS } from '../common/constants';
import { SettingsService } from '../common/settings.service';
import { CatalogService } from '../catalog/catalog.service';
import { Release } from '../entities';
import { MailService } from '../mail/mail.service';
import { COUNTRIES } from './countries';

/** Everything the public website pages need, in one request. */
@Controller('site')
export class SiteController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly settings: SettingsService,
    @InjectRepository(Release) private readonly releases: Repository<Release>,
    private readonly mail: MailService,
  ) {}

  /** Recent Contact messages per address, so nobody can flood the admin's inbox. */
  private readonly recent = new Map<string, number[]>();

  @Get()
  async site() {
    const courses = await this.catalog.allCourses(true);
    const first = courses[0];
    const lessons = first ? await this.catalog.courseLessons(first.id, true) : [];
    const latest = await this.releases.find({ where: { isLatest: true } });
    return {
      settings: await this.settings.all(),
      themes: courses.map((c) => this.catalog.card(c)),
      lessons: lessons.map((l) => ({ id: l.id, slug: l.slug, position: l.position, emoji: l.emoji, name: l.name, title: l.title, subtitle: l.subtitle })),
      releases: Object.fromEntries(latest.map((r) => [r.platform, { version: r.version, size: Number(r.size), notes: r.notes, createdAt: r.createdAt }])),
      platforms: PLATFORMS,
      packs: PACKS,
      countries: COUNTRIES,
      // PayPal is offered only once its keys are in api/.env (until then the pages mention Razorpay only)
      paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    };
  }

  /** The Contact page: emails the message to the admin. At most 5 messages an hour from one address. */
  @Post('contact')
  @HttpCode(200)
  async contact(@Body() body: Record<string, unknown>, @Ip() ip: string) {
    const text = (k: string, max: number) => String(body?.[k] ?? '').trim().slice(0, max);
    const m = { name: text('name', 80), email: text('email', 160), subject: text('subject', 120) || 'A question', message: text('message', 4000) };
    if (String(body?.website ?? '')) return { ok: true }; // a hidden field only robots fill in
    if (!m.name) throw new BadRequestException('Please tell us your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email)) throw new BadRequestException('Please enter a valid email address so we can reply.');
    if (m.message.length < 5) throw new BadRequestException('Please write your message.');
    const now = Date.now();
    const times = (this.recent.get(ip) || []).filter((t) => now - t < 3600_000);
    if (times.length >= 5) throw new HttpException('You have sent a few messages already. Please try again in an hour, or email us.', HttpStatus.TOO_MANY_REQUESTS);
    this.recent.set(ip, [...times, now]);
    const settings = await this.settings.all();
    const sent = await this.mail.sendContact(m, settings.contact_email);
    if (!sent) throw new ServiceUnavailableException(`Sorry, your message couldn't be sent just now. Please email ${settings.contact_email || 'us'} instead.`);
    return { ok: true, message: "Thank you! Your message has been sent. We'll reply to " + m.email + ' soon.' };
  }
}
