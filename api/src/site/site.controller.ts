import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PACKS, PLATFORMS } from '../common/constants';
import { SettingsService } from '../common/settings.service';
import { CatalogService } from '../catalog/catalog.service';
import { Release } from '../entities';
import { COUNTRIES } from './countries';

/** Everything the public website pages need, in one request. */
@Controller('site')
export class SiteController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly settings: SettingsService,
    @InjectRepository(Release) private readonly releases: Repository<Release>,
  ) {}

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
    };
  }
}
