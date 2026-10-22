import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { DEFAULT_COURSES, DEFAULT_SETTINGS } from '../common/constants';
import { Course, Lesson, Setting } from '../entities';

interface SeedLesson {
  slug: string; position: number; emoji: string; name: string; title: string; subtitle: string;
  video_bundled?: string; default_code: string; examples: { label: string; explain: string; output: string; code: string }[];
}

/** First start: fills in the website text and the 3 built-in themes with the 17 beginner lessons each. */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger('Seed');

  constructor(
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
  ) {}

  async onApplicationBootstrap() {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(await this.settings.findOne({ where: { key } }))) await this.settings.save({ key, value });
    }
    if ((await this.courses.count()) > 0) return;
    const seed = this.seedLessons();
    for (const [i, c] of DEFAULT_COURSES.entries()) {
      const course = await this.courses.save(this.courses.create({
        ...c, position: i + 1, published: true, imageFile: '', freeLessons: 3, characters: [],
      }));
      await this.lessons.save(seed.map((l) => this.lessons.create({
        courseId: course.id, slug: l.slug, position: l.position, emoji: l.emoji, name: l.name, title: l.title,
        subtitle: l.subtitle, videoBundled: l.video_bundled || '', videoFile: '', videoSize: 0,
        defaultCode: l.default_code, examples: l.examples, published: true,
      })));
    }
    this.log.log(`Added ${DEFAULT_COURSES.length} themes with ${seed.length} lessons each`);
  }

  private seedLessons(): SeedLesson[] {
    for (const dir of [join(__dirname, '..', '..', 'seed'), join(__dirname, '..', '..', '..', 'seed'), join(process.cwd(), 'seed')]) {
      try {
        return JSON.parse(readFileSync(join(dir, 'default_lessons.json'), 'utf8')).lessons;
      } catch {
        /* try the next place */
      }
    }
    this.log.warn('seed/default_lessons.json not found: themes start without lessons');
    return [];
  }
}
