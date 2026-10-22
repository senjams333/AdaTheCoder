import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';
import { CatalogService } from '../catalog/catalog.service';
import { CHARACTER_SLOTS, IMAGE_EXTENSIONS, PACKS, VIDEO_EXTENSIONS } from '../common/constants';
import { SLUG_RE, uploadDir } from '../common/util';
import { CharacterPicture, Course, Example, Lesson } from '../entities';

/** What a theme pack's theme.json holds. Paths are relative to the pack folder. */
export interface PackExample {
  label: string;
  explain?: string;
  output?: string;
  code?: string;
  /** the code in its own file, e.g. "code/02-hello.py" (instead of "code") */
  codeFile?: string;
}
export interface PackLesson {
  slug: string;
  emoji?: string;
  name: string;
  title: string;
  subtitle?: string;
  /** a video shipped inside the app, e.g. "vid/video1.mp4" */
  videoBundled?: string;
  /** a video file in the pack, e.g. "videos/print.mp4": uploaded, and installed apps download it */
  video?: string;
  defaultCode?: string;
  defaultCodeFile?: string;
  examples: PackExample[];
  published?: boolean;
}
export interface ThemePack {
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  features?: string[];
  /** friends, fairies, coding_club, or custom (then "characters" are used) */
  pack?: string;
  characters?: { name: string; picture: string }[];
  /** optional picture for the account page card */
  cardPicture?: string;
  premium?: boolean;
  price?: string;
  freeLessons?: number;
  position?: number;
  published?: boolean;
  lessons: PackLesson[];
}

export interface ImportResult {
  theme: string;
  created: boolean;
  lessonsAdded: number;
  lessonsUpdated: number;
  lessonsRemoved: number;
  filesCopied: number;
}

export class PackError extends Error {}

/** Loads theme packs (a folder with theme.json, pictures, videos and code files) into the database,
 *  and writes existing themes out as packs. */
@Injectable()
export class ThemePackService {
  constructor(private readonly catalog: CatalogService) {}

  /** Checks a pack and lists every problem (nothing is changed). */
  check(dir: string): { pack: ThemePack; problems: string[] } {
    const root = resolve(dir);
    const file = join(root, 'theme.json');
    if (!existsSync(file)) throw new PackError(`No theme.json in ${root}`);
    let pack: ThemePack;
    try {
      pack = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new PackError(`theme.json isn't valid JSON: ${(err as Error).message}`);
    }
    const p: string[] = [];
    const need = (rel: string | undefined, what: string, exts?: string[]) => {
      if (!rel) return;
      if (!existsSync(join(root, rel))) p.push(`${what}: file not found: ${rel}`);
      else if (exts && !exts.includes(extname(rel).toLowerCase())) p.push(`${what}: ${rel} must be one of ${exts.join(', ')}`);
    };
    if (!pack.name) p.push('"name" is missing.');
    if (!pack.slug || !SLUG_RE.test(pack.slug)) p.push('"slug" must use only letters, numbers, - and _ (like "space").');
    const kind = pack.pack || (pack.characters?.length ? 'custom' : 'friends');
    if (!PACKS[kind]) p.push(`"pack" must be one of: ${Object.keys(PACKS).join(', ')}.`);
    if (kind === 'custom') {
      if ((pack.characters || []).length !== CHARACTER_SLOTS) p.push(`"characters" needs exactly ${CHARACTER_SLOTS} characters (name + picture).`);
      (pack.characters || []).forEach((c, i) => {
        if (!c.name) p.push(`characters[${i + 1}]: "name" is missing.`);
        if (!c.picture) p.push(`characters[${i + 1}]: "picture" is missing.`);
        need(c.picture, `characters[${i + 1}]`, IMAGE_EXTENSIONS);
      });
    }
    need(pack.cardPicture, 'cardPicture', IMAGE_EXTENSIONS);
    if (pack.premium && !pack.price) p.push('Paid themes need a "price", like "$2.99".');
    if (!Array.isArray(pack.lessons) || !pack.lessons.length) p.push('"lessons" must list at least one lesson.');
    const seen = new Set<string>();
    (pack.lessons || []).forEach((l, i) => {
      const where = `lessons[${i + 1}]${l?.slug ? ` (${l.slug})` : ''}`;
      if (!l.slug || !SLUG_RE.test(l.slug)) p.push(`${where}: "slug" must use only letters, numbers, - and _.`);
      else if (seen.has(l.slug)) p.push(`${where}: the slug "${l.slug}" is used twice.`);
      seen.add(l.slug);
      if (!l.name) p.push(`${where}: "name" (the topic in the app's list) is missing.`);
      if (!l.title) p.push(`${where}: "title" is missing.`);
      need(l.video, `${where} video`, VIDEO_EXTENSIONS);
      need(l.defaultCodeFile, `${where} defaultCodeFile`);
      if (!Array.isArray(l.examples) || !l.examples.length) p.push(`${where}: add at least one example.`);
      (l.examples || []).forEach((e, j) => {
        if (!e.label) p.push(`${where} example ${j + 1}: "label" (the button text) is missing.`);
        if (!e.code && !e.codeFile) p.push(`${where} example ${j + 1}: give "code" or "codeFile".`);
        need(e.codeFile, `${where} example ${j + 1} codeFile`);
      });
    });
    return { pack, problems: p };
  }

  /** Adds or updates the theme and its lessons. Lessons are matched by slug; with removeMissing,
   *  lessons of the theme that the pack doesn't list are deleted. */
  async importPack(dir: string, { removeMissing = false } = {}): Promise<ImportResult> {
    const root = resolve(dir);
    const { pack, problems } = this.check(root);
    if (problems.length) throw new PackError(`The pack in ${root} has problems:\n  - ${problems.join('\n  - ')}`);
    const text = (rel?: string) => (rel ? readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n') : '');
    let copied = 0;
    const store = (rel: string, kind: 'videos' | 'courses', base: string, current?: string): string => {
      const src = join(root, rel);
      const hash = createHash('sha256').update(readFileSync(src)).digest('hex').slice(0, 10);
      const name = `${base}-${hash}${extname(rel).toLowerCase()}`;
      if (name === current && existsSync(join(uploadDir(kind), name))) return name; // unchanged
      copyFileSync(src, join(uploadDir(kind), name));
      copied++;
      return name;
    };

    const kind = pack.pack || (pack.characters?.length ? 'custom' : 'friends');
    let course = await this.catalog.courses.findOne({ where: { slug: pack.slug } });
    const created = !course;
    const oldChars = course?.characters || [];
    const characters: CharacterPicture[] = kind === 'custom'
      ? (pack.characters || []).map((c, i) => ({ name: c.name, file: store(c.picture, 'courses', `${pack.slug}-char`, oldChars[i]?.file) }))
      : [];
    for (const old of oldChars) {
      if (old.file && !characters.some((c) => c.file === old.file)) await this.catalog.removeUpload('courses', old.file);
    }
    let imageFile = course?.imageFile || '';
    if (pack.cardPicture) {
      const name = store(pack.cardPicture, 'courses', pack.slug, imageFile);
      if (imageFile && imageFile !== name) await this.catalog.removeUpload('courses', imageFile);
      imageFile = name;
    }
    const position = pack.position ?? course?.position ?? Math.max(0, ...(await this.catalog.allCourses()).map((c) => c.position)) + 1;
    const values: Partial<Course> = {
      slug: pack.slug, name: pack.name, tagline: pack.tagline || '', description: pack.description || '',
      features: (pack.features || []).join('\n'), pack: kind, price: pack.price || '', premium: Boolean(pack.premium),
      freeLessons: pack.freeLessons ?? 3, position, published: pack.published ?? true, imageFile, characters,
    };
    course = course ? Object.assign(course, values) : this.catalog.courses.create(values);
    course = await this.catalog.courses.save(course);

    const existing = new Map((await this.catalog.courseLessons(course.id)).map((l) => [l.slug, l]));
    let added = 0, updated = 0, removed = 0;
    for (const [i, pl] of pack.lessons.entries()) {
      const old = existing.get(pl.slug);
      existing.delete(pl.slug);
      let videoFile = old?.videoFile || '';
      let videoSize = Number(old?.videoSize || 0);
      if (pl.video) {
        const name = store(pl.video, 'videos', `${pack.slug}-${pl.slug}`, videoFile);
        if (videoFile && videoFile !== name) await this.catalog.removeUpload('videos', videoFile);
        videoFile = name;
        videoSize = statSync(join(root, pl.video)).size;
      } else if (videoFile) {
        await this.catalog.removeUpload('videos', videoFile);  // the pack no longer has a video for it
        videoFile = '';
        videoSize = 0;
      }
      const examples: Example[] = pl.examples.map((e) => ({
        label: e.label, explain: e.explain || '', output: e.output || '', code: (e.codeFile ? text(e.codeFile) : e.code || '').trimEnd(),
      }));
      const lv: Partial<Lesson> = {
        courseId: course.id, slug: pl.slug, position: i + 1, emoji: pl.emoji || '', name: pl.name, title: pl.title,
        subtitle: pl.subtitle || '', videoBundled: pl.videoBundled || '', videoFile, videoSize,
        defaultCode: (pl.defaultCodeFile ? text(pl.defaultCodeFile) : pl.defaultCode || '').trimEnd(),
        examples, published: pl.published ?? true,
      };
      await this.catalog.lessons.save(old ? Object.assign(old, lv) : this.catalog.lessons.create(lv));
      old ? updated++ : added++;
    }
    if (removeMissing) {
      for (const l of existing.values()) {
        await this.catalog.removeUpload('videos', l.videoFile);
        await this.catalog.lessons.remove(l);
        removed++;
      }
    } else {
      // lessons only the database has stay, after the pack's lessons
      let pos = pack.lessons.length;
      for (const l of [...existing.values()].sort((a, b) => a.position - b.position)) {
        l.position = ++pos;
        await this.catalog.lessons.save(l);
      }
    }
    return { theme: pack.slug, created, lessonsAdded: added, lessonsUpdated: updated, lessonsRemoved: removed, filesCopied: copied };
  }

  /** Writes a theme from the database out as a pack folder (a starting point for a new theme). */
  async exportPack(slug: string, dir: string): Promise<string> {
    const course = await this.catalog.courses.findOne({ where: { slug } });
    if (!course) throw new PackError(`There's no theme with the slug "${slug}".`);
    const root = resolve(dir);
    for (const sub of ['', 'code', 'pictures', 'videos']) mkdirSync(join(root, sub), { recursive: true });
    const copyOut = (kind: 'videos' | 'courses', file: string, sub: string, name: string) => {
      const src = join(uploadDir(kind), file);
      if (!existsSync(src)) return undefined;
      const rel = `${sub}/${name}${extname(file)}`;
      copyFileSync(src, join(root, rel));
      return rel;
    };
    const lessons = await this.catalog.courseLessons(course.id);
    const pack: ThemePack = {
      slug: course.slug, name: course.name, tagline: course.tagline, description: course.description,
      features: course.features.split('\n').map((f) => f.trim()).filter(Boolean), pack: course.pack,
      premium: course.premium, price: course.price, freeLessons: course.freeLessons, position: course.position,
      published: course.published,
      lessons: lessons.map((l, i) => {
        const n = String(i + 1).padStart(2, '0');
        const examples: PackExample[] = (l.examples || []).map((e, j) => {
          const rel = `code/${n}-${l.slug}-${j + 1}.py`;
          writeFileSync(join(root, rel), `${e.code}\n`);
          return { label: e.label, explain: e.explain, output: e.output, codeFile: rel };
        });
        const out: PackLesson = {
          slug: l.slug, emoji: l.emoji, name: l.name, title: l.title, subtitle: l.subtitle, examples, published: l.published,
        };
        if (l.videoBundled) out.videoBundled = l.videoBundled;
        if (l.videoFile) out.video = copyOut('videos', l.videoFile, 'videos', `${n}-${l.slug}`);
        if (l.defaultCode) {
          out.defaultCodeFile = `code/${n}-${l.slug}-start.py`;
          writeFileSync(join(root, out.defaultCodeFile), `${l.defaultCode}\n`);
        }
        return out;
      }),
    };
    if (course.pack === 'custom') {
      pack.characters = (course.characters || []).map((c, i) => ({
        name: c.name, picture: copyOut('courses', c.file, 'pictures', `character-${i + 1}`) || '',
      }));
    }
    if (course.imageFile) pack.cardPicture = copyOut('courses', course.imageFile, 'pictures', 'card');
    writeFileSync(join(root, 'theme.json'), `${JSON.stringify(pack, null, 2)}\n`);
    return root;
  }
}

/** For log lines: "space: 3 lessons added, 0 updated" */
export function describe(r: ImportResult): string {
  return `${r.theme}: theme ${r.created ? 'added' : 'updated'}, ${r.lessonsAdded} lessons added, ${r.lessonsUpdated} updated` +
    (r.lessonsRemoved ? `, ${r.lessonsRemoved} removed` : '') + `, ${r.filesCopied} files copied`;
}

