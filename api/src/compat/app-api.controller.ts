import { Body, Controller, Get, HttpCode, HttpException, Ip, Post, Query, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { CatalogService } from '../catalog/catalog.service';
import { PLATFORMS } from '../common/constants';
import { SettingsService } from '../common/settings.service';
import { revisionOf, siteUrl, versionNewer } from '../common/util';
import { Release } from '../entities';

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

  /** The app's log-in: { ok, name, email, licences: [theme ids] } or 401 { ok: false, error } */
  @Post('v3/login')
  @HttpCode(200)
  async login(@Body() body: Record<string, unknown>, @Ip() ip: string, @Res() res: Response) {
    try {
      const { user } = await this.auth.login(
        { email: String(body.email || '').trim().toLowerCase(), password: String(body.password || '') }, ip);
      return res.json({ ok: true, name: user.name, email: user.email, licences: await this.catalog.licencedSlugs(user.id) });
    } catch (err) {
      return res.status(401).json({ ok: false, error: this.text(err) });
    }
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
      return res.status(201).json({ ok: true, name: user.name, email: user.email, licences: [] });
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
    return { message: (await this.settings.all()).app_message || '' };
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
