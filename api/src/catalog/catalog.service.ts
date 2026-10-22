import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { PACKS } from '../common/constants';
import { mediaUrl, siteUrl, uploadDir } from '../common/util';
import { Course, Lesson, Licence } from '../entities';

/** Themes and lessons as the website, the admin and the desktop app see them. */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Course) readonly courses: Repository<Course>,
    @InjectRepository(Lesson) readonly lessons: Repository<Lesson>,
    @InjectRepository(Licence) readonly licences: Repository<Licence>,
  ) {}

  allCourses(publishedOnly = false): Promise<Course[]> {
    return this.courses.find({ where: publishedOnly ? { published: true } : {}, order: { position: 'ASC', id: 'ASC' } });
  }

  courseLessons(courseId: number, publishedOnly = false): Promise<Lesson[]> {
    return this.lessons.find({
      where: publishedOnly ? { courseId, published: true } : { courseId },
      order: { position: 'ASC', id: 'ASC' },
    });
  }

  characters(c: Course) {
    if (c.pack !== 'custom') return [];
    return (c.characters || []).filter((ch) => ch.file).map((ch) => ({ name: ch.name || '', file: ch.file, url: mediaUrl('courses', ch.file) }));
  }

  /** A theme for the website and admin pages. Pictures of built-in packs are the website's own (/img/...). */
  card(c: Course) {
    const pack = PACKS[c.pack] || PACKS.friends;
    const chars = this.characters(c);
    const names = chars.map((ch) => ch.name).filter(Boolean);
    const label = chars.length
      ? names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` : names.join('') || pack.label
      : pack.label;
    let images: string[];
    if (c.imageFile) images = [mediaUrl('courses', c.imageFile)];
    else if (chars.length) images = chars.map((ch) => ch.url);
    else images = pack.images.map((i) => `/img/${i}`);
    return {
      id: c.id, slug: c.slug, name: c.name, tagline: c.tagline, description: c.description,
      features: c.features, featureList: (c.features || '').split('\n').map((f) => f.trim()).filter(Boolean),
      pack: c.pack, packLabel: label, price: c.price, premium: c.premium, freeLessons: c.freeLessons,
      imageFile: c.imageFile, imageUrl: c.imageFile ? mediaUrl('courses', c.imageFile) : null,
      characters: chars, images, position: c.position, published: c.published, updatedAt: c.updatedAt,
    };
  }

  /** A lesson as the desktop app downloads it. */
  lessonPayload(l: Lesson) {
    const video: Record<string, unknown> = { bundled: l.videoBundled };
    if (l.videoFile) Object.assign(video, { file: l.videoFile, size: Number(l.videoSize), url: mediaUrl('videos', l.videoFile) });
    return {
      id: l.slug, position: l.position, emoji: l.emoji, name: l.name, title: l.title, subtitle: l.subtitle,
      video, default_code: l.defaultCode, examples: l.examples || [],
    };
  }

  /** Every published theme with its published lessons: GET /api/v3/courses for the desktop app. */
  async appCourses() {
    const out = [];
    for (const c of await this.allCourses(true)) {
      out.push({
        id: c.slug, name: c.name, tagline: c.tagline, pack: c.pack, position: c.position, premium: c.premium,
        price: c.price, free_lessons: c.premium ? c.freeLessons : null,
        buy_url: c.premium ? `${siteUrl()}/account?theme=${encodeURIComponent(c.slug)}` : '',
        characters: this.characters(c),
        lessons: (await this.courseLessons(c.id, true)).map((l) => this.lessonPayload(l)),
      });
    }
    return out;
  }

  /** Slugs of the themes a family holds a licence for. */
  async licencedSlugs(userId: number): Promise<string[]> {
    const rows = await this.licences.find({ where: { userId }, relations: { course: true } });
    return rows.filter((r) => r.licence && r.course).map((r) => r.course.slug);
  }

  async removeUpload(kind: 'videos' | 'courses' | 'releases', file: string | null | undefined) {
    if (!file) return;
    try {
      await unlink(join(uploadDir(kind), file));
    } catch {
      /* already gone */
    }
  }
}
