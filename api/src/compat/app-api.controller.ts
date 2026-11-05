import { Body, Controller, Get, HttpCode, HttpException, Ip, Post, Query, Res, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { AppTokenGuard, CurrentUser } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { PLATFORMS } from '../common/constants';
import { SettingsService } from '../common/settings.service';
import { revisionOf, siteUrl, versionNewer } from '../common/util';
import { Release, User } from '../entities';
import { PaymentsService } from '../payments/payments.service';

/** The addresses the desktop app calls, with exactly the answers it expects
 *  (the same as the old Python website, so installed apps keep working). */
@Controller()
export class AppApiController {
  private readonly signups = new Map<string, number[]>();

  constructor(
    private readonly catalog: CatalogService,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
    @InjectRepository(Release) private readonly releases: Repository<Release>,
    private readonly payments: PaymentsService,
  ) {}

  @Get('v3/courses')
  async courses(@Query('since') since?: string) {
    const courses = await this.catalog.appCourses();
    const revision = revisionOf(courses);
    if (since === revision) return { revision, unchanged: true };
    return { revision, unchanged: false, courses };
  }

  @Get('v2/lessons')
  async lessons(@Res() res: Response, @Query('course') slug?: string, @Query('since') since?: string) {
    const courses = await this.catalog.allCourses(true);
    const course = slug ? courses.find((c) => c.slug === slug) : courses[0];
    if (slug && !course) return res.status(404).json({ error: 'no such course' });
    const lessons = course ? (await this.catalog.courseLessons(course.id, true)).map((l) => this.catalog.lessonPayload(l)) : [];
    const revision = revisionOf(lessons);
    return res.json(since === revision ? { revision, unchanged: true } : { revision, unchanged: false, lessons });
  }

  /** The app's log-in: { ok, name, email, child_name, licences: [theme ids] } or 401 { ok: false, error }.
   *  child_name is the child's name from the parent's profile: the app greets the child with it. */
  @Post('v3/login')
  @HttpCode(200)
  async login(@Body() body: Record<string, unknown>, @Ip() ip: string, @Res() res: Response) {
    try {
      const { user } = await this.auth.login(
        { email: String(body.email || '').trim().toLowerCase(), password: String(body.password || '') }, ip);
      return res.json({ ok: true, name: user.name, email: user.email, child_name: user.childName || '',
        licences: await this.catalog.licencedSlugs(user.id), licence_codes: await this.catalog.licenceCodes(user.id),
        app_token: this.auth.appToken(user) });
    } catch (err) {
      return res.status(401).json({ ok: false, error: this.text(err) });
    }
  }

  /** The family's licences again (after paying on the website, the app unlocks the theme by itself). */
  @Get('v3/licences')
  @UseGuards(AppTokenGuard)
  async licences(@CurrentUser() user: User) {
    return { ok: true, licences: await this.catalog.licencedSlugs(user.id), licence_codes: await this.catalog.licenceCodes(user.id),
      child_name: user.childName || '' };
  }

  /** The app's "I have a licence 🔑": { ok, theme, name, licences } or 400/404 { ok: false, error }. */
  @Post('v3/licence')
  @HttpCode(200)
  @UseGuards(AppTokenGuard)
  async redeem(@CurrentUser() user: User, @Body() body: { licence?: string; theme?: string }, @Res() res: Response) {
    try {
      const got = await this.payments.redeem(user, String(body.licence || ''), body.theme ? String(body.theme) : undefined);
      return res.json({ ...got, licences: await this.catalog.licencedSlugs(user.id), licence_codes: await this.catalog.licenceCodes(user.id) });
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 500;
      return res.status(status).json({ ok: false, error: this.text(err), licences: await this.catalog.licencedSlugs(user.id) });
    }
  }

  /** The Upgrade card's "Pay": a 15-minute page on the website for this theme, already logged in. */
  @Post('v3/pay-link')
  @HttpCode(200)
  @UseGuards(AppTokenGuard)
  async payLink(@CurrentUser() user: User, @Body() body: { theme?: string; method?: string }) {
    const theme = String(body.theme || '').trim();
    const method = ['razorpay', 'paypal'].includes(String(body.method)) ? `&method=${body.method}` : '';
    return { ok: true, url: `${siteUrl()}/pay?theme=${encodeURIComponent(theme)}${method}&t=${encodeURIComponent(this.auth.payToken(user))}` };
  }

  /** The app's sign-up: 201 { ok, name, email, licences: [] } · 400/409/429 { ok: false, errors } */
  @Post('v3/register')
  async register(@Body() body: Record<string, unknown>, @Ip() ip: string, @Res() res: Response) {
    const key = ip || 'unknown';
    const recent = (this.signups.get(key) || []).filter((t) => Date.now() - t < 15 * 60 * 1000);
    if (recent.length >= 8) {
      return res.status(429).json({ ok: false, errors: ['Too many new accounts from here. Wait 15 minutes, then try again.'] });
    }
    const dto = plainToInstance(RegisterDto, {
      ...body, childName: body.childName ?? body.child_name, childAge: body.childAge ?? body.child_age,
    });
    const problems = await validate(dto, { whitelist: true });
    if (problems.length) {
      const errors = [...new Set(problems.flatMap((p) => Object.values(p.constraints || {})))];
      return res.status(400).json({ ok: false, errors });
    }
    try {
      const { user } = await this.auth.register(dto);
      this.signups.set(key, [...recent, Date.now()]);
      return res.status(201).json({ ok: true, name: user.name, email: user.email, child_name: user.childName || '', licences: [] });
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 400;
      return res.status(status === 409 ? 409 : 400).json({ ok: false, errors: [this.text(err)] });
    }
  }

  @Get('v1/app/latest')
  async latest(@Res() res: Response, @Query('platform') platform = '', @Query('version') current = '0.0.0') {
    if (!PLATFORMS[platform]) return res.status(400).json({ error: "platform must be 'windows' or 'mac'" });
    const r = await this.releases.findOne({ where: { platform, isLatest: true } });
    if (!r) return res.json({ update_available: false, required: false });
    return res.json({
      latest_version: r.version, notes: r.notes, released_at: r.createdAt,
      update_available: versionNewer(r.version, current),
      required: Boolean(r.minSupported) && versionNewer(r.minSupported, current),
      download_page: `${siteUrl()}/account`,
    });
  }

  @Get('v1/announcement')
  async announcement() {
    // also the app's home screen, which the admin sets on the Website text page
    const s = await this.settings.all();
    return { message: s.app_message || '', welcome: s.app_welcome || '', home_theme: s.app_home_theme || '' };
  }

  private text(err: unknown): string {
    if (err instanceof HttpException) {
      const r = err.getResponse() as string | { message?: string | string[] };
      const m = typeof r === 'string' ? r : r.message;
      return Array.isArray(m) ? m.join(' ') : m || err.message;
    }
    return 'Something went wrong. Please try again.';
  }
}
