import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AdminGuard } from '../auth/guards';
import { SettingsService } from '../common/settings.service';
import { Course, Download, Lesson, Release, User } from '../entities';

/** Admin: overview and website text. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly settings: SettingsService,
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

  @Get('settings')
  getSettings() {
    return this.settings.all();
  }

  @Put('settings')
  async putSettings(@Body() body: Record<string, unknown>) {
    return { ok: true, settings: await this.settings.save(body), message: 'Website text saved. The app picks up the new message next time it checks.' };
  }
}
