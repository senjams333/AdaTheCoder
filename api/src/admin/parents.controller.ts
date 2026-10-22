import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AdminGuard } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { trimmed } from '../common/util';
import { Download, Licence, User } from '../entities';

/** Admin: parent accounts, their plan and theme licences. */
@Controller('admin/parents')
@UseGuards(AdminGuard)
export class AdminParentsController {
  constructor(
    private readonly catalog: CatalogService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Download) private readonly downloads: Repository<Download>,
    @InjectRepository(Licence) private readonly licences: Repository<Licence>,
  ) {}

  @Get()
  async list(@Query('q') q = '') {
    const term = q.trim();
    const where = term
      ? [{ role: 'parent', email: Like(`%${term}%`) }, { role: 'parent', name: Like(`%${term}%`) }]
      : { role: 'parent' };
    const parents = await this.users.find({ where, order: { createdAt: 'DESC' } });
    const licences = await this.licences.find();
    const out = [];
    for (const p of parents) {
      out.push({
        id: p.id, name: p.name, email: p.email, city: p.city, country: p.country, childName: p.childName, childAge: p.childAge,
        plan: p.plan, isActive: p.isActive, createdAt: p.createdAt, lastLogin: p.lastLogin,
        downloads: await this.downloads.count({ where: { userId: p.id } }),
        licences: Object.fromEntries(licences.filter((l) => l.userId === p.id).map((l) => [l.courseId, l.licence])),
      });
    }
    const paidThemes = (await this.catalog.allCourses()).filter((c) => c.premium).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
    return { parents: out, paidThemes };
  }

  @Post(':id/toggle')
  @HttpCode(200)
  async toggle(@Param('id', ParseIntPipe) id: number) {
    const p = await this.find(id);
    p.isActive = !p.isActive;
    await this.users.save(p);
    return { ok: true, message: p.isActive ? 'Account turned on.' : 'Account turned off.' };
  }

  /** { plan: "free" | "premium", licences: { [themeId]: "LICENCE-CODE" or "" } } */
  @Put(':id/plan')
  async plan(@Param('id', ParseIntPipe) id: number, @Body() body: { plan?: string; licences?: Record<string, string> }) {
    const p = await this.find(id);
    p.plan = body.plan === 'premium' ? 'premium' : 'free';
    await this.users.save(p);
    for (const c of await this.catalog.allCourses()) {
      const code = trimmed(body.licences?.[String(c.id)], 120);
      if (code) await this.licences.save({ userId: id, courseId: c.id, licence: code });
      else await this.licences.delete({ userId: id, courseId: c.id });
    }
    return { ok: true, message: 'Plan and licences saved.' };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.users.remove(await this.find(id));
    return { ok: true, message: 'Parent account deleted.' };
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="parents.csv"')
  async csv() {
    const cell = (v: unknown) => {
      const s = v instanceof Date ? v.toISOString() : String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = await this.users.find({ where: { role: 'parent' }, order: { createdAt: 'ASC' } });
    const lines = [['name', 'email', 'city', 'country', 'child_age', 'registered', 'last_login', 'active'].join(',')];
    for (const r of rows) {
      lines.push([r.name, r.email, r.city, r.country, r.childAge ?? '', r.createdAt, r.lastLogin ?? '', r.isActive ? 'yes' : 'no'].map(cell).join(','));
    }
    return lines.join('\n') + '\n';
  }

  private async find(id: number): Promise<User> {
    const p = await this.users.findOne({ where: { id, role: 'parent' } });
    if (!p) throw new NotFoundException('That parent was not found.');
    return p;
  }
}
