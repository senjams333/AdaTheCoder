import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Put,
  UploadedFile as File, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { VIDEO_EXTENSIONS } from '../common/constants';
import { discard, keep, uploadOptions, UploadedFile } from '../common/uploads';
import { ext, mediaUrl, SLUG_RE, trimmed, truthy } from '../common/util';
import { Example, Lesson } from '../entities';

/** Admin: lessons inside a theme. The topic (emoji + name) is what the app's lesson list shows. */
@Controller('admin/lessons')
@UseGuards(AdminGuard)
export class AdminLessonsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number) {
    const l = await this.find(id);
    return {
      id: l.id, courseId: l.courseId, slug: l.slug, position: l.position, emoji: l.emoji, name: l.name, title: l.title,
      subtitle: l.subtitle, videoBundled: l.videoBundled, videoFile: l.videoFile, videoSize: Number(l.videoSize),
      videoUrl: l.videoFile ? mediaUrl('videos', l.videoFile) : null, defaultCode: l.defaultCode,
      examples: l.examples || [], published: l.published,
    };
  }

  /** What a new lesson in this theme starts with. */
  @Get('new/:courseId')
  async blank(@Param('courseId', ParseIntPipe) courseId: number) {
    const next = Math.max(0, ...(await this.catalog.courseLessons(courseId)).map((l) => l.position)) + 1;
    return {
      courseId, slug: `lesson${next}`, position: next, emoji: '', name: '', title: '', subtitle: '', videoBundled: '',
      videoFile: '', videoSize: 0, videoUrl: null, defaultCode: '', examples: [{ label: '', explain: '', output: '', code: '' }], published: true,
    };
  }

  @Post()
  @UseInterceptors(FileInterceptor('video', uploadOptions))
  create(@Body() body: Record<string, string>, @File() video?: UploadedFile) {
    return this.save(null, body, video);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('video', uploadOptions))
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, string>, @File() video?: UploadedFile) {
    return this.save(id, body, video);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const l = await this.find(id);
    await this.catalog.removeUpload('videos', l.videoFile);
    await this.catalog.lessons.remove(l);
    return { ok: true, courseId: l.courseId, message: 'Lesson deleted.' };
  }

  /** Moves a lesson one place up or down in its theme. */
  @Post(':id/move')
  @HttpCode(200)
  async move(@Param('id', ParseIntPipe) id: number, @Body() body: { direction?: string }) {
    const l = await this.find(id);
    const order = await this.catalog.courseLessons(l.courseId);
    const i = order.findIndex((x) => x.id === id);
    const j = body.direction === 'up' ? i - 1 : i + 1;
    if (j >= 0 && j < order.length) {
      [order[i], order[j]] = [order[j], order[i]];
      order.forEach((x, n) => (x.position = n + 1));
      await this.catalog.lessons.save(order);
    }
    return { ok: true };
  }

  private async find(id: number): Promise<Lesson> {
    const l = await this.catalog.lessons.findOne({ where: { id } });
    if (!l) throw new NotFoundException('That lesson was not found.');
    return l;
  }

  private async save(id: number | null, body: Record<string, string>, video?: UploadedFile) {
    const lesson = id ? await this.find(id) : null;
    const errors: string[] = [];
    let examples: Example[] = [];
    try {
      const raw = JSON.parse(body.examples || '[]');
      examples = (Array.isArray(raw) ? raw : []).map((e: Partial<Example>) => ({
        label: trimmed(e.label, 120), explain: String(e.explain || '').replace(/\r\n/g, '\n').trim(),
        output: String(e.output || '').replace(/\r\n/g, '\n').trim(), code: String(e.code || '').replace(/\r\n/g, '\n').trimEnd(),
      })).filter((e) => e.label || e.explain || e.output || e.code).slice(0, 30);
    } catch {
      errors.push("The examples couldn't be read. Reload the page and try again.");
    }
    examples.forEach((e, i) => {
      if (!e.label || !e.code) errors.push(`Example ${i + 1} needs a button label and some code.`);
    });
    const data = {
      courseId: Number(body.courseId), slug: trimmed(body.slug, 80), position: trimmed(body.position || '0'),
      emoji: trimmed(body.emoji, 12), name: trimmed(body.name, 120), title: trimmed(body.title, 200), subtitle: trimmed(body.subtitle),
      videoBundled: trimmed(body.videoBundled, 190).replace(/\\/g, '/'),
      defaultCode: String(body.defaultCode || '').replace(/\r\n/g, '\n').trimEnd(), published: truthy(body.published),
    };
    if (!data.courseId || !(await this.catalog.courses.findOne({ where: { id: data.courseId } }))) errors.push('Choose which theme this lesson belongs to.');
    if (!data.name) errors.push('Give the topic a name, like PRINT HELLO.');
    if (!data.title) errors.push('Give the lesson a title.');
    if (!SLUG_RE.test(data.slug)) errors.push('The lesson ID can only use letters, numbers, - and _, like lesson_loops.');
    if (!/^-?\d+$/.test(data.position)) errors.push('Order must be a whole number.');
    if (!examples.length) errors.push('Add at least one example.');
    if (video && !VIDEO_EXTENSIONS.includes(ext(video.originalname))) errors.push('Lesson videos must be .mp4 files.');
    if (data.courseId && SLUG_RE.test(data.slug)) {
      const other = await this.catalog.lessons.findOne({ where: { courseId: data.courseId, slug: data.slug } });
      if (other && other.id !== id) errors.push('Another lesson in this theme already uses that lesson ID. Choose a different one.');
    }
    if (errors.length) {
      await discard(video);
      throw new BadRequestException(errors);
    }
    let videoFile = lesson?.videoFile || '';
    let videoSize = Number(lesson?.videoSize || 0);
    if (video) {
      const name = await keep(video, 'videos', data.slug);
      await this.catalog.removeUpload('videos', videoFile);
      videoFile = name;
      videoSize = video.size;
    } else if (truthy(body.removeVideo) && videoFile) {
      await this.catalog.removeUpload('videos', videoFile);
      videoFile = '';
      videoSize = 0;
    }
    const values = { ...data, position: Number(data.position), examples, videoFile, videoSize };
    if (lesson) {
      Object.assign(lesson, values);
      await this.catalog.lessons.save(lesson);
      return { ok: true, id: lesson.id, courseId: lesson.courseId, message: `Lesson '${lesson.name}' saved. Installed apps get it next time they check.` };
    }
    const created = await this.catalog.lessons.save(this.catalog.lessons.create(values));
    return { ok: true, id: created.id, courseId: created.courseId, message: `Lesson '${created.name}' added. Installed apps get it next time they check.` };
  }
}
