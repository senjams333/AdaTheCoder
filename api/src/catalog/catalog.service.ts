import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { PACKS } from '../common/constants';
import { mediaUrl, siteUrl, uploadDir } from '../common/util';
import { Course, Lesson, Licence } from '../entities';

/** Themes and lessons as the website, the admin and the desktop app see them. */
@Injectable()
export class CatalogService implements OnApplicationBootstrap {
  private readonly log = new Logger('Videos');
  private webmQueue: string[] = [];
  private webmBusy = false;
  private noFfmpeg = false;

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
      pack: c.pack, packLabel: label, price: c.price, priceInr: c.priceInr, razorpayButton: c.razorpayButton, premium: c.premium, freeLessons: c.freeLessons,
      imageFile: c.imageFile, imageUrl: c.imageFile ? mediaUrl('courses', c.imageFile) : null,
      characters: chars, images, position: c.position, published: c.published, updatedAt: c.updatedAt,
    };
  }

  /** A lesson as the desktop app downloads it. */
  lessonPayload(l: Lesson) {
    const video: Record<string, unknown> = { bundled: l.videoBundled };
    if (l.videoFile) Object.assign(video, { file: l.videoFile, size: Number(l.videoSize), url: mediaUrl('videos', l.videoFile) });
    // the WebM copy the app's window plays (made by webmCopy after the upload, when the server has ffmpeg)
    const webm = l.videoFile ? l.videoFile.replace(/\.[^.]+$/, '') + '.webm' : '';
    if (webm && existsSync(join(uploadDir('videos'), webm))) Object.assign(video, { webm_file: webm, webm_url: mediaUrl('videos', webm) });
    return {
      id: l.slug, position: l.position, emoji: l.emoji, name: l.name, title: l.title, subtitle: l.subtitle,
      video, default_code: l.defaultCode, examples: l.examples || [],
    };
  }

  /** A lesson the family hasn't unlocked: its name for the lesson list, but no examples, code or video.
   *  The app downloads the rest only after the theme is bought. */
  lockedLessonPayload(l: Lesson) {
    return { id: l.slug, position: l.position, emoji: l.emoji, name: l.name, title: l.title, subtitle: l.subtitle,
      locked: true, video: { bundled: '' }, default_code: '', examples: [] };
  }

  /** Every published theme with its published lessons: GET /api/v3/courses for the desktop app.
   *  A paid theme the family hasn't bought comes with only its free lessons in full; the others are names only.
   *  owned: the theme slugs this family bought (from the app's log-in token). */
  async appCourses(owned: Set<string> = new Set()) {
    const out = [];
    for (const c of await this.allCourses(true)) {
      const full = !c.premium || owned.has(c.slug);
      const free = Math.max(1, Number(c.freeLessons ?? 1));        // the app always opens the first lesson
      out.push({
        id: c.slug, name: c.name, tagline: c.tagline, description: c.description || '', pack: c.pack, position: c.position, premium: c.premium,
        price: c.price, free_lessons: c.premium ? c.freeLessons : null,
        buy_url: c.premium ? `${siteUrl()}/account?theme=${encodeURIComponent(c.slug)}` : '',
        characters: this.characters(c),
        lessons: (await this.courseLessons(c.id, true)).map((l, i) => (full || i < free ? this.lessonPayload(l) : this.lockedLessonPayload(l))),
        full,
      });
    }
    return out;
  }

  /** Slugs of the themes a family holds a licence for. */
  /** The family's licence codes by theme: { "friends": "ADA-7KQ2-M9XD-4TFP" } (the app shows them on a theme's License page). */
  async licenceCodes(userId: number): Promise<Record<string, string>> {
    const rows = await this.licences.find({ where: { userId }, relations: { course: true } });
    return Object.fromEntries(rows.filter((r) => r.licence && r.course).map((r) => [r.course.slug, r.licence]));
  }

  async licencedSlugs(userId: number): Promise<string[]> {
    const rows = await this.licences.find({ where: { userId }, relations: { course: true } });
    return rows.filter((r) => r.licence && r.course).map((r) => r.course.slug);
  }

  /** The app's window plays WebM, not MP4: every uploaded lesson video also gets a light 720p WebM copy, made in the
   *  background with ffmpeg (sudo apt install ffmpeg on the server), one video at a time. Until the copy is ready the
   *  app says the video is being prepared; when it is, the app downloads it by itself (within a minute). */
  webmCopy(file: string) {
    if (!file || this.webmQueue.includes(file)) return;
    this.webmQueue.push(file);
    void this.nextWebm();
  }

  private async nextWebm() {
    if (this.webmBusy) return;
    const file = this.webmQueue.shift();
    if (!file) return;
    this.webmBusy = true;
    const src = join(uploadDir('videos'), file);
    const out = src.replace(/\.[^.]+$/, '') + '.webm';
    const part = out + '.part.webm';
    const done = async (ok: boolean, why = '') => {
      const { rename } = await import('fs/promises');
      if (ok) {
        await rename(part, out).catch(() => undefined);
        this.log.log(`WebM ready for the app: ${file}`);
      } else {
        await unlink(part).catch(() => undefined);
        if (why) this.log.warn(`No WebM for ${file}: ${why}`);
      }
      this.webmBusy = false;
      void this.nextWebm();
    };
    if (!existsSync(src)) return done(false, 'the video file is missing');
    this.log.log(`Making the WebM copy the app plays: ${file}`);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'scale=-2:720', '-r', '25', '-c:v', 'libvpx', '-b:v', '1400k',
      '-crf', '10', '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libvorbis', '-b:a', '96k', part], { stdio: 'ignore' });
    let failed = false;
    ff.on('error', () => {
      failed = true;
      if (!this.noFfmpeg) this.log.error('ffmpeg is not installed, so uploaded videos cannot play in the app. Install it: sudo apt install ffmpeg (then restart the API).');
      this.noFfmpeg = true;
      void done(false);
    });
    ff.on('close', (code) => { if (!failed) void done(code === 0, code === 0 ? '' : `ffmpeg stopped with code ${code}`); });
  }

  /** At start: any uploaded lesson video without its WebM copy (uploaded before ffmpeg was installed, or with a theme pack)
   *  gets one now. */
  async onApplicationBootstrap() {
    try {
      const lessons = await this.lessons.find();
      for (const l of lessons) {
        if (!l.videoFile) continue;
        const webm = l.videoFile.replace(/\.[^.]+$/, '') + '.webm';
        if (existsSync(join(uploadDir('videos'), l.videoFile)) && !existsSync(join(uploadDir('videos'), webm))) this.webmCopy(l.videoFile);
      }
    } catch (err) {
      this.log.warn(`Couldn't check the lesson videos: ${(err as Error).message}`);
    }
  }

  async removeUpload(kind: 'videos' | 'courses' | 'releases', file: string | null | undefined) {
    if (!file) return;
    if (kind === 'videos' && file.startsWith('default-')) return;   // a built-in lesson video, shared by every theme
    if (kind === 'videos') await unlink(join(uploadDir(kind), file.replace(/\.[^.]+$/, '') + '.webm')).catch(() => undefined);
    try {
      await unlink(join(uploadDir(kind), file));
    } catch {
      /* already gone */
    }
  }
}
