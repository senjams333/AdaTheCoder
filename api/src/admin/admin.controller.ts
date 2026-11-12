import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UploadedFile as File,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AdminGuard } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { IMAGE_EXTENSIONS } from '../common/constants';
import { SettingsService } from '../common/settings.service';
import { discard, keep, uploadOptions, UploadedFile } from '../common/uploads';
import { ext, mediaUrl, uploadDir } from '../common/util';
import { Course, Download, Lesson, Release, User } from '../entities';

/** Admin: overview and website text, and the pictures of the app's home characters. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly settings: SettingsService,
    private readonly catalog: CatalogService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Download) private readonly downloads: Repository<Download>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(Release) private readonly releases: Repository<Release>,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recent = await this.users.find({ where: { role: 'parent' }, order: { createdAt: 'DESC' }, take: 6 });
    const latest = await this.releases.find({ where: { isLatest: true } });
    return {
      stats: {
        parents: await this.users.count({ where: { role: 'parent' } }),
        newParents: await this.users.count({ where: { role: 'parent', createdAt: MoreThanOrEqual(weekAgo) } }),
        downloads: await this.downloads.count(),
        lessons: await this.lessons.count({ where: { published: true } }),
        drafts: await this.lessons.count({ where: { published: false } }),
        themes: await this.courses.count({ where: { published: true } }),
      },
      releases: Object.fromEntries(latest.map((r) => [r.platform, { version: r.version, downloads: r.downloads, createdAt: r.createdAt }])),
      recent: recent.map((u) => ({ name: u.name, email: u.email, childAge: u.childAge, city: u.city, country: u.country, createdAt: u.createdAt })),
    };
  }

  /** The settings, with the addresses of the uploaded home pictures (for the admin's previews). */
  @Get('settings')
  async getSettings() {
    return this.withPictures(await this.settings.all());
  }

  @Put('settings')
  async putSettings(@Body() body: Record<string, unknown>) {
    const saved = await this.settings.save(body);
    return { ok: true, settings: this.withPictures(saved), message: 'Website text saved. The app picks up the changes next time it checks (within a few minutes).' };
  }

  /** A new picture for one of the app's 3 home characters (slot 1, 2 or 3). It replaces the old one straight away. */
  @Post('home-character/:slot')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('picture', uploadOptions))
  async homeCharacter(@Param('slot', ParseIntPipe) slot: number, @File() picture?: UploadedFile) {
    if (![1, 2, 3].includes(slot)) { await discard(picture); throw new BadRequestException(['There are 3 home characters: 1, 2 or 3.']); }
    if (!picture) throw new BadRequestException(['No picture arrived. Choose the picture again.']);
    if (!IMAGE_EXTENSIONS.includes(ext(picture.originalname))) {
      await discard(picture);
      throw new BadRequestException(['Character pictures must be .png, .jpg or .webp files (a .png with a see-through background looks best).']);
    }
    const key = `home_char${slot}_file`;
    const old = (await this.settings.all())[key];
    const name = await keep(picture, 'courses', `home-char${slot}`);
    await this.settings.setOne(key, name);
    await this.catalog.removeUpload('courses', old);
    return { ok: true, file: name, url: mediaUrl('courses', name), message: 'Picture saved. Installed apps show it within a few minutes.' };
  }

  /** Back to the picture built into the app for that home character. */
  @Delete('home-character/:slot')
  async homeCharacterReset(@Param('slot', ParseIntPipe) slot: number) {
    if (![1, 2, 3].includes(slot)) throw new BadRequestException(['There are 3 home characters: 1, 2 or 3.']);
    const key = `home_char${slot}_file`;
    await this.catalog.removeUpload('courses', (await this.settings.all())[key]);
    await this.settings.setOne(key, '');
    return { ok: true, message: 'Back to the picture built into the app.' };
  }

  /** A picture for the website's home page (a friend in "Meet your coding friends"). It is used once the admin
   *  saves the website text. */
  @Post('site-picture')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('picture', uploadOptions))
  async sitePicture(@File() picture?: UploadedFile) {
    if (!picture) throw new BadRequestException(['No picture arrived. Choose the picture again.']);
    if (!IMAGE_EXTENSIONS.includes(ext(picture.originalname))) {
      await discard(picture);
      throw new BadRequestException(['Pictures must be .png, .jpg or .webp files (a .png or .webp with a see-through background looks best).']);
    }
    const name = await keep(picture, 'courses', 'site-pic');
    return { ok: true, file: name, url: mediaUrl('courses', name), message: 'Picture added. Click Save website text to show it on the website.' };
  }

  private withPictures(s: Record<string, string>) {
    const out: Record<string, string> = { ...s };
    for (const i of [1, 2, 3]) {
      const f = s[`home_char${i}_file`];
      out[`home_char${i}_url`] = f && existsSync(join(uploadDir('courses'), f)) ? mediaUrl('courses', f) : '';
    }
    return out;
  }
}
