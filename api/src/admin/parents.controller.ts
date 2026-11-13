import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { AdminGuard } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { trimmed } from '../common/util';
import { Download, Licence, Payment, User } from '../entities';
import { MailService } from '../mail/mail.service';
import { newLicenceCode } from '../payments/payments.service';

/** Why the admin unlocks a theme by hand (admin → Parents → Unlock). */
export const UNLOCK_REASONS: Record<string, string> = {
  'payment-error': "Paid, but the licence wasn't made (payment error)",
  'paid-other-way': 'Paid another way (bank transfer, UPI or cash to us)',
  gift: 'Free: gift, promotion, school or tester',
  other: 'Other',
};

/** Admin: parent accounts, their plan and theme licences. */
@Controller('admin/parents')
@UseGuards(AdminGuard)
export class AdminParentsController {
  constructor(
    private readonly catalog: CatalogService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Download) private readonly downloads: Repository<Download>,
    @InjectRepository(Licence) private readonly licences: Repository<Licence>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly mail: MailService,
  ) {}

  @Get()
  async list(@Query('q') q = '') {
    const term = q.trim();
    const where = term
      ? [{ role: 'parent', email: Like(`%${term}%`) }, { role: 'parent', name: Like(`%${term}%`) }]
      : { role: 'parent' };
    const parents = await this.users.find({ where, order: { createdAt: 'DESC' } });
    const licences = await this.licences.find();
    const courses = await this.catalog.allCourses();
    const themeName = (id: number) => courses.find((c) => c.id === id)?.name || `Theme ${id}`;
    const ids = parents.map((p) => p.id);
    const payments = ids.length ? await this.payments.find({ where: { userId: In(ids) }, order: { createdAt: 'DESC' } }) : [];
    const out = [];
    for (const p of parents) {
      out.push({
        id: p.id, name: p.name, email: p.email, city: p.city, country: p.country, childName: p.childName, childAge: p.childAge,
        plan: p.plan, isActive: p.isActive, createdAt: p.createdAt, lastLogin: p.lastLogin,
        downloads: await this.downloads.count({ where: { userId: p.id } }),
        licences: Object.fromEntries(licences.filter((l) => l.userId === p.id).map((l) => [l.courseId, l.licence])),
        // every try at paying; "paid" without a licence for that theme = the licence wasn't made (unlock it by hand)
        payments: payments.filter((x) => x.userId === p.id).map((x) => ({
          id: x.id, courseId: x.courseId, theme: themeName(x.courseId), provider: x.provider, orderId: x.orderId,
          paymentId: x.paymentId, amount: x.amount, currency: x.currency, status: x.status, note: x.note, createdAt: x.createdAt,
          unlocked: licences.some((l) => l.userId === p.id && l.courseId === x.courseId),
        })),
      });
    }
    const paidThemes = courses.filter((c) => c.premium).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
    return { parents: out, paidThemes, unlockReasons: UNLOCK_REASONS };
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

  /**
   * Unlock a paid theme for one parent by hand, e.g. they paid but the licence wasn't made because of an error.
   * { courseId, reason (UNLOCK_REASONS), paymentId? (their payment try to mark paid), reference? (Razorpay pay_... /
   *   PayPal id, as proof), note?, email? (send the licence to the parent) }
   * Makes a real licence (the app unlocks by itself) and keeps a record in the payments table: provider "admin",
   * or the parent's own payment try marked "paid", with the reason in its note.
   */
  @Post(':id/unlock')
  @HttpCode(200)
  async unlock(@Param('id', ParseIntPipe) id: number, @Body() body: {
    courseId?: number; reason?: string; paymentId?: number | null; reference?: string; note?: string; email?: boolean;
  }) {
    const parent = await this.find(id);
    const course = (await this.catalog.allCourses()).find((c) => c.id === Number(body.courseId));
    const errors: string[] = [];
    if (!course || !course.premium) errors.push('Choose the paid theme to unlock.');
    const reason = String(body.reason || '');
    if (!UNLOCK_REASONS[reason]) errors.push('Choose why you are unlocking it.');
    const reference = trimmed(body.reference, 80);
    const extra = trimmed(body.note, 120);
    let payment: Payment | null = null;
    if (body.paymentId) {
      payment = await this.payments.findOne({ where: { id: Number(body.paymentId), userId: id } });
      if (!payment) errors.push("That payment doesn't belong to this parent.");
      else if (course && payment.courseId !== course.id) errors.push('That payment is for a different theme.');
    }
    if (reason === 'payment-error' && !payment && !reference) {
      errors.push("For a payment error, choose the parent's payment below, or type the payment reference from Razorpay or PayPal (pay_...).");
    }
    if (reason === 'other' && !extra) errors.push('Please write a short note saying why.');
    if (errors.length) throw new BadRequestException(errors);
    const theme = course as NonNullable<typeof course>;

    const had = await this.licences.findOne({ where: { userId: id, courseId: theme.id } });
    if (had) throw new BadRequestException([`${parent.name} already has ${theme.name} (licence ${had.licence}).`]);

    const licence = newLicenceCode();
    await this.licences.save({ userId: id, courseId: theme.id, licence });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const note = `Unlocked by admin ${stamp} UTC: ${UNLOCK_REASONS[reason]}${extra ? `. ${extra}` : ''}`.slice(0, 255);
    if (payment) {
      payment.status = 'paid';
      if (reference) payment.paymentId = reference;
      payment.note = note;
      await this.payments.save(payment);
    } else {
      await this.payments.save(this.payments.create({
        userId: id, courseId: theme.id, provider: 'admin', orderId: `admin-${Date.now()}-${id}-${theme.id}`.slice(0, 80),
        amount: 0, currency: 'INR', status: 'paid', paymentId: reference, note,
      }));
    }
    const paid = reason === 'payment-error';  // the email says sorry: they paid, the licence wasn't made
    const sent = body.email ? await this.mail.sendUnlocked({ name: parent.name, email: parent.email, theme: theme.name, licence, paid }) : false;
    return {
      ok: true, licence,
      message: `${theme.name} unlocked for ${parent.name}. Licence ${licence}.${body.email ? (sent ? ' The licence was emailed to them.' : " The email couldn't be sent: give them the licence yourself (it's also on their account page).") : ''} The app unlocks it by itself.`,
    };
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
