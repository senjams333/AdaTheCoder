import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Put,
  UploadedFiles as Files, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { CHARACTER_SLOTS, IMAGE_EXTENSIONS, PACKS } from '../common/constants';
import { discard, first, keep, uploadOptions, UploadedFiles } from '../common/uploads';
import { ext, SLUG_RE, trimmed, truthy } from '../common/util';
import { CharacterPicture, Course } from '../entities';

const FILE_FIELDS = [{ name: 'image', maxCount: 1 }, ...Array.from({ length: CHARACTER_SLOTS }, (_, i) => ({ name: `charFile${i}`, maxCount: 1 }))];

/** Admin: themes (each with its own lessons, characters, price and free lessons). */
@Controller('admin/themes')
@UseGuards(AdminGuard)
export class AdminThemesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async list() {
    const out = [];
    for (const c of await this.catalog.allCourses()) {
      const lessons = await this.catalog.courseLessons(c.id);
      out.push({ ...this.catalog.card(c), total: lessons.length, live: lessons.filter((l) => l.published).length });
    }
    return out;
  }

  /** One theme with its lessons inside it. */
  @Get(':id')
  async one(@Param('id', ParseIntPipe) id: number) {
    const c = await this.find(id);
    const lessons = await this.catalog.courseLessons(id);
    return {
      theme: this.catalog.card(c),
      live: lessons.filter((l) => l.published).length,
      lessons: lessons.map((l) => ({
        id: l.id, slug: l.slug, position: l.position, emoji: l.emoji, name: l.name, title: l.title, subtitle: l.subtitle,
        videoBundled: l.videoBundled, videoFile: l.videoFile, videoSize: Number(l.videoSize),
        exampleCount: (l.examples || []).length, published: l.published,
      })),
    };
  }

  @Post()
  @UseInterceptors(FileFieldsInterceptor(FILE_FIELDS, uploadOptions))
  create(@Body() body: Record<string, string>, @Files() files: UploadedFiles) {
    return this.save(null, body, files);
  }

  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor(FILE_FIELDS, uploadOptions))
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, string>, @Files() files: UploadedFiles) {
    return this.save(id, body, files);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const c = await this.find(id);
    if ((await this.catalog.courses.count()) <= 1) throw new BadRequestException(["You can't delete the only theme. Add another one first."]);
    for (const l of await this.catalog.courseLessons(id)) await this.catalog.removeUpload('videos', l.videoFile);
    await this.catalog.removeUpload('courses', c.imageFile);
    for (const ch of c.characters || []) await this.catalog.removeUpload('courses', ch.file);
    await this.catalog.courses.remove(c);
    return { ok: true, message: `Theme '${c.name}' and its lessons were deleted.` };
  }

  /** Copies another theme's lessons in (lessons this theme already has with the same ID are kept). */
  @Post(':id/copy')
  @HttpCode(200)
  async copy(@Param('id', ParseIntPipe) id: number, @Body() body: { from?: number | string }) {
    await this.find(id);
    const from = Number(body.from);
    if (!from || from === id) throw new BadRequestException(['Choose which theme to copy the lessons from.']);
    const copied = await this.copyLessons(from, id);
    return { ok: true, copied, message: copied ? `Copied ${copied} lessons. Edit them to fit this theme.` : 'Nothing new to copy: this theme already has those lessons.' };
  }

  private async find(id: number): Promise<Course> {
    const c = await this.catalog.courses.findOne({ where: { id } });
    if (!c) throw new NotFoundException('That theme was not found.');
    return c;
  }

  private async copyLessons(fromId: number, toId: number): Promise<number> {
    const have = new Set((await this.catalog.courseLessons(toId)).map((l) => l.slug));
    const start = Math.max(0, ...(await this.catalog.courseLessons(toId)).map((l) => l.position));
    const source = (await this.catalog.courseLessons(fromId)).filter((l) => !have.has(l.slug));
    await this.catalog.lessons.save(source.map((l) => this.catalog.lessons.create({
      courseId: toId, slug: l.slug, position: start + l.position, emoji: l.emoji, name: l.name, title: l.title,
      subtitle: l.subtitle, videoBundled: l.videoBundled, videoFile: '', videoSize: 0, defaultCode: l.defaultCode,
      examples: l.examples, published: l.published,
    })));
    return source.length;
  }

  private async save(id: number | null, body: Record<string, string>, files: UploadedFiles) {
    const course = id ? await this.find(id) : null;
    const image = first(files, 'image');
    const charFiles = Array.from({ length: CHARACTER_SLOTS }, (_, i) => first(files, `charFile${i}`));
    const data = {
      slug: trimmed(body.slug, 60), name: trimmed(body.name, 120), tagline: trimmed(body.tagline),
      description: String(body.description || '').replace(/\r\n/g, '\n').trim(),
      features: String(body.features || '').replace(/\r\n/g, '\n').trim(),
      pack: trimmed(body.pack, 30), price: trimmed(body.price, 30), premium: truthy(body.premium),
      position: trimmed(body.position || '0'), freeLessons: trimmed(body.freeLessons ?? '3') || '0', published: truthy(body.published),
    };
    const errors: string[] = [];
    if (!data.name) errors.push('Give the theme a name, like Learn Coding in Space.');
    if (!SLUG_RE.test(data.slug)) errors.push('The theme ID can only use letters, numbers, - and _, like space.');
    else {
      const other = await this.catalog.courses.findOne({ where: { slug: data.slug } });
      if (other && other.id !== id) errors.push('Another theme already uses that theme ID.');
    }
    if (!PACKS[data.pack]) errors.push('Choose the characters for this theme.');
    if (data.premium && !data.price) errors.push('Paid themes need a price, like $3.69.');
    if (!/^-?\d+$/.test(data.position)) errors.push('Order must be a whole number.');
    if (!/^\d+$/.test(data.freeLessons)) errors.push('Free lessons must be a whole number, like 3.');
    if (image && !IMAGE_EXTENSIONS.includes(ext(image.originalname))) errors.push('Card pictures must be .png, .jpg or .webp files.');
    const old: CharacterPicture[] = course?.characters || [];
    const chars: CharacterPicture[] = charFiles.map((f, i) => ({ name: trimmed(body[`charName${i}`], 30), file: old[i]?.file || '' }));
    charFiles.forEach((f, i) => {
      if (f && !IMAGE_EXTENSIONS.includes(ext(f.originalname))) errors.push(`Character ${i + 1}: pictures must be .png, .jpg or .webp files.`);
    });
    if (data.pack === 'custom') {
      chars.forEach((c, i) => {
        if (!c.name) errors.push(`Give character ${i + 1} a name.`);
        if (!c.file && !charFiles[i]) errors.push(`Upload a picture for character ${i + 1}.`);
      });
    }
    if (errors.length) {
      await discard(image, ...charFiles);
      throw new BadRequestException(errors);
    }
    for (const [i, f] of charFiles.entries()) {
      if (!f) continue;
      const name = await keep(f, 'courses', `${data.slug}-char`);
      await this.catalog.removeUpload('courses', chars[i].file);
      chars[i].file = name;
    }
    let imageFile = course?.imageFile || '';
    if (image) {
      const name = await keep(image, 'courses', data.slug);
      await this.catalog.removeUpload('courses', imageFile);
      imageFile = name;
    } else if (truthy(body.removeImage) && imageFile) {
      await this.catalog.removeUpload('courses', imageFile);
      imageFile = '';
    }
    const values = { ...data, position: Number(data.position), freeLessons: Number(data.freeLessons), imageFile, characters: chars };
    if (course) {
      Object.assign(course, values);
      await this.catalog.courses.save(course);
      return { ok: true, id: course.id, message: `Theme '${course.name}' saved. Installed apps get the change next time they check.` };
    }
    const created = await this.catalog.courses.save(this.catalog.courses.create(values));
    const copyFrom = Number(body.copyFrom);
    const copied = copyFrom ? await this.copyLessons(copyFrom, created.id) : 0;
    return {
      ok: true, id: created.id,
      message: `Theme '${created.name}' added` + (copied ? ` with ${copied} lessons copied.` : '. Now add its lessons.'),
    };
  }
}
