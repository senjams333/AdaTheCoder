import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post,
  UploadedFile as File, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminGuard } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { PLATFORMS } from '../common/constants';
import { discard, keep, uploadOptions, UploadedFile } from '../common/uploads';
import { ext, trimmed, truthy, VERSION_RE } from '../common/util';
import { Release } from '../entities';

/** Admin: app installers. The "current" one per platform is what parents download and apps update to. */
@Controller('admin/releases')
@UseGuards(AdminGuard)
export class AdminReleasesController {
  constructor(private readonly catalog: CatalogService, @InjectRepository(Release) private readonly releases: Repository<Release>) {}

  @Get()
  async list() {
    const rows = await this.releases.find({ order: { platform: 'ASC', createdAt: 'DESC' } });
    return rows.map((r) => ({ ...r, size: Number(r.size) }));
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async upload(@Body() body: Record<string, string>, @File() file?: UploadedFile) {
    const platform = trimmed(body.platform, 20), version = trimmed(body.version, 20), minSupported = trimmed(body.minSupported, 20);
    const errors: string[] = [];
    if (!PLATFORMS[platform]) errors.push('Choose Windows or Mac.');
    if (!VERSION_RE.test(version)) errors.push('Write the version as three numbers, like 1.2.0.');
    if (minSupported && !VERSION_RE.test(minSupported)) errors.push('Write the oldest allowed version as three numbers, like 1.0.0, or leave it empty.');
    if (!file) errors.push('Choose the installer file to upload.');
    else if (PLATFORMS[platform] && !PLATFORMS[platform].extensions.includes(ext(file.originalname))) {
      errors.push(`${PLATFORMS[platform].label} installers must be one of: ${PLATFORMS[platform].extensions.join(', ')}.`);
    }
    if (!errors.length && (await this.releases.findOne({ where: { platform, version } }))) {
      errors.push(`Version ${version} for ${PLATFORMS[platform].label} already exists. Use a higher version number.`);
    }
    if (errors.length || !file) {
      await discard(file);
      throw new BadRequestException(errors);
    }
    const stored = await keep(file, 'releases', `${platform}-${version}`);
    const makeLatest = truthy(body.makeLatest);
    if (makeLatest) await this.releases.update({ platform }, { isLatest: false });
    await this.releases.save(this.releases.create({
      platform, version, notes: String(body.notes || '').trim(), filename: stored,
      originalName: file.originalname.replace(/[^\w.\- ]+/g, '_') || stored, size: file.size, minSupported, isLatest: makeLatest,
    }));
    return {
      ok: true,
      message: `Uploaded ${PLATFORMS[platform].label} version ${version}.` + (makeLatest ? ' Installed apps will offer this update next time they open.' : ''),
    };
  }

  @Post(':id/latest')
  @HttpCode(200)
  async makeLatest(@Param('id', ParseIntPipe) id: number) {
    const r = await this.find(id);
    await this.releases.update({ platform: r.platform }, { isLatest: false });
    await this.releases.update({ id }, { isLatest: true });
    return { ok: true, message: `Version ${r.version} is now the ${PLATFORMS[r.platform].label} download.` };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const r = await this.find(id);
    if (r.isLatest) throw new BadRequestException(['Make another version the current download before deleting this one.']);
    await this.catalog.removeUpload('releases', r.filename);
    await this.releases.remove(r);
    return { ok: true, message: `Deleted version ${r.version}.` };
  }

  private async find(id: number): Promise<Release> {
    const r = await this.releases.findOne({ where: { id } });
    if (!r) throw new NotFoundException('That version was not found.');
    return r;
  }
}
