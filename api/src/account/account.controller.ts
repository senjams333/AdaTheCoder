import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { join } from 'path';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { AuthGuard, CurrentUser } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { PLATFORMS } from '../common/constants';
import { apiOrigin, trimmed, uploadDir } from '../common/util';
import { Download, Release } from '../entities';
import { publicUser, User } from '../entities/user.entity';

/** The logged-in parent's own page: details, themes and licences, app downloads. */
@Controller('account')
export class AccountController {
  constructor(
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Release) private readonly releases: Repository<Release>,
    @InjectRepository(Download) private readonly downloads: Repository<Download>,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  async account(@CurrentUser() user: User) {
    const owned = new Map((await this.catalog.licences.find({ where: { userId: user.id } })).map((l) => [l.courseId, l.licence]));
    const themes = (await this.catalog.allCourses(true)).filter((c) => c.premium)
      .map((c) => ({ ...this.catalog.card(c), licence: owned.get(c.id) || null }));
    const latest = await this.releases.find({ where: { isLatest: true } });
    return {
      user: publicUser(user),
      themes,
      releases: Object.fromEntries(latest.map((r) => [r.platform, { version: r.version, size: Number(r.size), notes: r.notes, createdAt: r.createdAt }])),
    };
  }

  @Patch()
  @UseGuards(AuthGuard)
  async update(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    const name = trimmed(body.name, 80), city = trimmed(body.city, 80), country = trimmed(body.country, 80);
    if (!name || !city || !country) throw new BadRequestException(['Fill in your name, city and country.']);
    Object.assign(user, { name, city, country });
    if (body.childName !== undefined) user.childName = trimmed(body.childName, 40) || null;
    return { ok: true, user: publicUser(await this.users.save(user)) };
  }

  @Post('password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  password(@CurrentUser() user: User, @Body() body: { current?: string; new?: string }) {
    return this.auth.changePassword(user, String(body.current || ''), String(body.new || ''));
  }

  @Post('delete')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  remove(@CurrentUser() user: User, @Body() body: { password?: string }) {
    return this.auth.deleteAccount(user, String(body.password || ''));
  }

  /** Step 1 of a download: a link that works for 5 minutes (a browser link can't carry the log-in header). */
  @Post('download/:platform')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async downloadLink(@CurrentUser() user: User, @Param('platform') platform: string) {
    if (!PLATFORMS[platform]) throw new NotFoundException('Choose Windows or Mac.');
    const release = await this.releases.findOne({ where: { platform, isLatest: true } });
    if (!release) throw new NotFoundException(`The ${PLATFORMS[platform].label} app isn't available yet. Check back soon.`);
    const ticket = this.jwt.sign({ dl: release.id, sub: user.id }, { expiresIn: '5m' });
    return { url: `${apiOrigin()}/api/account/file?ticket=${encodeURIComponent(ticket)}`, version: release.version };
  }

  /** Step 2: the installer itself. */
  @Get('file')
  async file(@Query('ticket') ticket: string, @Res() res: Response) {
    let data: { dl: number; sub: number };
    try {
      data = this.jwt.verify(ticket);
    } catch {
      throw new BadRequestException('This download link has expired. Go back to your account page and click Download again.');
    }
    const release = await this.releases.findOne({ where: { id: data.dl } });
    if (!release) throw new NotFoundException('That version was removed. Go back and download the current one.');
    await this.releases.increment({ id: release.id }, 'downloads', 1);
    await this.downloads.save(this.downloads.create({ userId: data.sub, releaseId: release.id }));
    res.download(join(uploadDir('releases'), release.filename), release.originalName);
  }
}
