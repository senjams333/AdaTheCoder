import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import { siteUrl } from '../common/util';
import { Course, Licence, Payment, User } from '../entities';

/** A theme's price in the smallest unit (cents, paise), or null when it isn't a price. "$4.99" → 499 */
export function minorUnits(price: string): number | null {
  const m = String(price || '').replace(/,/g, '').match(/\d+(\.\d{1,2})?/);
  if (!m) return null;
  const amount = Math.round(parseFloat(m[0]) * 100);
  return amount > 0 ? amount : null;
}

/** "ADA-7KQ2-M9XD-4TFP": the licence a family gets when a payment goes through. */
export function newLicenceCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => abc[b % abc.length]).join('');
  return `ADA-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a || ''), y = Buffer.from(b || '');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Buying a paid theme with Razorpay (India: UPI, cards, net banking, in rupees) or PayPal (cards and PayPal, in dollars).
 *
 *   Razorpay  create an order here → the website opens Razorpay Checkout → its answer is checked with the
 *             key secret (verify), and also by Razorpay's webhook, so a closed browser tab still unlocks the theme
 *   PayPal    create an order here → the parent approves it on PayPal → PayPal sends them back to the website,
 *             which asks here to capture it
 *
 * Keys come from .env (see .env.example). A method whose keys are missing simply isn't offered.
 */
@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');
  private paypalToken: { value: string; until: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly catalog: CatalogService,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Licence) private readonly licences: Repository<Licence>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // ------------------------------------------------------------------ what can be paid, and how
  private get razorpayKey() { return this.config.get<string>('RAZORPAY_KEY_ID') || ''; }
  private get razorpaySecret() { return this.config.get<string>('RAZORPAY_KEY_SECRET') || ''; }
  private get paypalClient() { return this.config.get<string>('PAYPAL_CLIENT_ID') || ''; }
  private get paypalSecret() { return this.config.get<string>('PAYPAL_CLIENT_SECRET') || ''; }
  private get paypalCurrency() { return (this.config.get<string>('PAYPAL_CURRENCY') || 'USD').toUpperCase(); }
  private get paypalApi() {
    return this.config.get<string>('PAYPAL_MODE') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  async theme(slug: string): Promise<Course> {
    const course = await this.catalog.courses.findOne({ where: { slug, published: true } });
    if (!course || !course.premium) throw new NotFoundException('That theme is free or no longer exists.');
    return course;
  }

  /** A Razorpay Payment Button made in the Razorpay dashboard (Payment Button → pl_...): the theme's own, or the .env one. */
  buttonFor(course: Course): string {
    return course.razorpayButton || this.config.get<string>('RAZORPAY_PAYMENT_BUTTON_ID') || '';
  }

  /** The ways this theme can be paid for: { razorpay: {amount, currency, label, button?} | null, paypal: ... }
   *  razorpay.button: the pay page shows Razorpay's own Payment Button instead of opening Checkout with an order. */
  methods(course: Course) {
    const inr = minorUnits(course.priceInr);
    const usd = minorUnits(course.price);
    const button = this.buttonFor(course);
    return {
      razorpay: button ? { amount: inr || 0, currency: 'INR', label: course.priceInr ? `₹${course.priceInr}` : '', button }
        : this.razorpayKey && this.razorpaySecret && inr ? { amount: inr, currency: 'INR', label: `₹${course.priceInr}` } : null,
      paypal: this.paypalClient && this.paypalSecret && usd ? { amount: usd, currency: this.paypalCurrency, label: course.price } : null,
    };
  }

  async owns(user: User, course: Course): Promise<string | null> {
    return (await this.licences.findOne({ where: { userId: user.id, courseId: course.id } }))?.licence || null;
  }

  /** The licence is given once; paying twice by mistake keeps the first code. */
  private async grant(payment: Payment, providerPaymentId: string): Promise<string> {
    if (payment.status !== 'paid') {
      payment.status = 'paid';
      payment.paymentId = providerPaymentId.slice(0, 80);
      await this.payments.save(payment);
    }
    const had = await this.licences.findOne({ where: { userId: payment.userId, courseId: payment.courseId } });
    if (had) return had.licence;
    const licence = newLicenceCode();
    await this.licences.save({ userId: payment.userId, courseId: payment.courseId, licence });
    this.log.log(`Licence ${licence} for user ${payment.userId}, theme ${payment.courseId} (${payment.provider} ${payment.orderId})`);
    return licence;
  }

  private async paidAnswer(payment: Payment, providerPaymentId: string) {
    const licence = await this.grant(payment, providerPaymentId);
    const course = await this.catalog.courses.findOne({ where: { id: payment.courseId } });
    return { ok: true, licence, theme: course?.slug || '', name: course?.name || '',
      message: `Thank you! ${course?.name || 'The theme'} is unlocked. The app unlocks every lesson by itself in a minute.` };
  }

  private async provider(url: string, init: RequestInit, what: string) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      this.log.error(`${what}: ${err}`);
      throw new BadGatewayException(["Couldn't reach the payment service. Please try again in a minute."]);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`${what}: ${res.status} ${JSON.stringify(body).slice(0, 400)}`);
      throw new BadGatewayException(["The payment service said no. Please try again, or use the other payment method."]);
    }
    return body as Record<string, any>;
  }

  // ------------------------------------------------------------------ Razorpay
  async razorpayOrder(user: User, course: Course) {
    const price = this.methods(course).razorpay;
    if (!price || !price.amount || !this.razorpayKey || !this.razorpaySecret) {
      throw new BadRequestException(['Razorpay is not available for this theme.']);
    }
    const order = await this.provider('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${this.razorpayKey}:${this.razorpaySecret}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: price.amount, currency: price.currency, receipt: `u${user.id}-c${course.id}-${Date.now()}`.slice(0, 40),
        notes: { user_id: String(user.id), theme: course.slug },
      }),
    }, 'Razorpay order');
    await this.payments.save({ userId: user.id, courseId: course.id, provider: 'razorpay', orderId: String(order.id),
      amount: price.amount, currency: price.currency });
    return {
      key: this.razorpayKey, order_id: order.id, amount: price.amount, currency: price.currency,
      name: 'Ada The Coder', description: `${course.name}: every lesson`,
      prefill: { name: user.name, email: user.email },
    };
  }

  /** The browser's answer after Razorpay Checkout: checked with the key secret before anything unlocks. */
  async razorpayVerify(body: Record<string, unknown>) {
    const orderId = String(body.razorpay_order_id || ''), paymentId = String(body.razorpay_payment_id || '');
    const signature = String(body.razorpay_signature || '');
    const expected = createHmac('sha256', this.razorpaySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (!orderId || !paymentId || !this.razorpaySecret || !sameText(expected, signature)) {
      throw new BadRequestException(["We couldn't confirm that payment. If money left your account, write to us and we'll sort it out."]);
    }
    const payment = await this.payments.findOne({ where: { orderId, provider: 'razorpay' } });
    if (!payment) throw new NotFoundException(['That order is unknown.']);
    return this.paidAnswer(payment, paymentId);
  }

  /** Razorpay's webhook (payment.captured / order.paid), signed with RAZORPAY_WEBHOOK_SECRET over the raw body. */
  async razorpayWebhook(raw: Buffer | undefined, signature: string) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';
    if (!secret || !raw) throw new BadRequestException('webhook not set up');
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    if (!sameText(expected, signature)) throw new BadRequestException('bad signature');
    const event = JSON.parse(raw.toString('utf8'));
    const entity = event?.payload?.payment?.entity;
    if (!['payment.captured', 'order.paid'].includes(event?.event) || !entity) return { ok: true, ignored: true };
    if (!entity.order_id) return this.paymentButtonPaid(entity);
    const payment = await this.payments.findOne({ where: { orderId: String(entity.order_id), provider: 'razorpay' } });
    if (!payment) return this.paymentButtonPaid(entity);
    if (Number(entity.amount) !== payment.amount) {
      this.log.error(`Razorpay ${payment.orderId}: paid ${entity.amount}, expected ${payment.amount}`);
      return { ok: true, ignored: true };
    }
    await this.grant(payment, String(entity.id || ''));
    return { ok: true };
  }

  /** A payment through a Razorpay Payment Button: no order of ours, so the parent is found by the email typed on
   *  Razorpay's form, and the theme by the button (or, failing that, by the amount among themes with a button). */
  private async paymentButtonPaid(entity: Record<string, any>) {
    if (entity.status && entity.status !== 'captured') return { ok: true, ignored: true };
    const email = String(entity.email || entity.notes?.email || '').trim().toLowerCase();
    const user = email ? await this.users.findOne({ where: { email } }) : null;
    const themes = (await this.catalog.courses.find({ where: { premium: true } }))
      .filter((c) => this.buttonFor(c) && minorUnits(c.priceInr) === Number(entity.amount));
    const buttonId = String(entity.payment_button_id || entity.notes?.payment_button_id || '');
    const byButton = buttonId ? themes.filter((c) => this.buttonFor(c) === buttonId) : [];
    const course = byButton.length === 1 ? byButton[0] : themes.length === 1 ? themes[0] : null;
    if (!user || !course) {
      this.log.warn(`Razorpay button payment ${entity.id} (${email || 'no email'}, ${entity.amount}): no matching `
        + `${user ? 'theme (give each theme its own button and price in rupees)' : 'parent account (they must use their account email)'}`);
      return { ok: true, ignored: true };
    }
    const existing = await this.payments.findOne({ where: { orderId: String(entity.id) } });
    const payment = existing || await this.payments.save({ userId: user.id, courseId: course.id, provider: 'razorpay-button',
      orderId: String(entity.id), amount: Number(entity.amount), currency: String(entity.currency || 'INR') });
    await this.grant(payment, String(entity.id));
    return { ok: true };
  }

  // ------------------------------------------------------------------ PayPal
  private async paypalAuth(): Promise<string> {
    if (this.paypalToken && this.paypalToken.until > Date.now()) return this.paypalToken.value;
    const answer = await this.provider(`${this.paypalApi}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${this.paypalClient}:${this.paypalSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    }, 'PayPal log-in');
    this.paypalToken = { value: String(answer.access_token), until: Date.now() + (Number(answer.expires_in || 300) - 60) * 1000 };
    return this.paypalToken.value;
  }

  /** passToken: the app's short pay link token, carried through PayPal so the return page still knows the parent. */
  async paypalOrder(user: User, course: Course, passToken = '') {
    const price = this.methods(course).paypal;
    if (!price) throw new BadRequestException(['PayPal is not available for this theme.']);
    const back = `${siteUrl()}/pay/paypal-return${passToken ? `?t=${encodeURIComponent(passToken)}` : ''}`;
    const cancel = `${siteUrl()}/pay?theme=${encodeURIComponent(course.slug)}&cancelled=1${passToken ? `&t=${encodeURIComponent(passToken)}` : ''}`;
    const order = await this.provider(`${this.paypalApi}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.paypalAuth()}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: course.slug, custom_id: `u${user.id}-c${course.id}`,
          description: `Ada The Coder: ${course.name}`.slice(0, 127),
          amount: { currency_code: price.currency, value: (price.amount / 100).toFixed(2) },
        }],
        payment_source: { paypal: { experience_context: {
          brand_name: 'Ada The Coder', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
          return_url: back, cancel_url: cancel,
        } } },
      }),
    }, 'PayPal order');
    await this.payments.save({ userId: user.id, courseId: course.id, provider: 'paypal', orderId: String(order.id),
      amount: price.amount, currency: price.currency });
    const approve = (order.links || []).find((l: { rel: string }) => l.rel === 'payer-action' || l.rel === 'approve');
    if (!approve) throw new BadGatewayException(['PayPal did not send a payment page. Please try again.']);
    return { order_id: order.id, approve_url: approve.href };
  }

  /** PayPal sent the parent back: take the money and unlock the theme. Safe to call twice. */
  async paypalCapture(orderId: string) {
    const payment = await this.payments.findOne({ where: { orderId: String(orderId || ''), provider: 'paypal' } });
    if (!payment) throw new NotFoundException(['That PayPal order is unknown.']);
    if (payment.status === 'paid') return this.paidAnswer(payment, payment.paymentId);
    const token = await this.paypalAuth();
    let order: Record<string, any>;
    try {
      order = await this.provider(`${this.paypalApi}/v2/checkout/orders/${encodeURIComponent(payment.orderId)}/capture`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }, 'PayPal capture');
    } catch (err) {
      // already captured (a second tab, a refresh): look at the order instead
      order = await this.provider(`${this.paypalApi}/v2/checkout/orders/${encodeURIComponent(payment.orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, 'PayPal order check');
      if (order.status !== 'COMPLETED') throw err;
    }
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    const paid = capture && capture.status === 'COMPLETED' && minorUnits(capture.amount?.value) === payment.amount
      && String(capture.amount?.currency_code).toUpperCase() === payment.currency;
    if (order.status !== 'COMPLETED' || !paid) {
      payment.status = 'failed';
      await this.payments.save(payment);
      throw new BadRequestException(["PayPal didn't complete the payment. Nothing was charged; please try again."]);
    }
    return this.paidAnswer(payment, String(capture.id));
  }
}
