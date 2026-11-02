import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, PayGuard } from '../auth/guards';
import { CatalogService } from '../catalog/catalog.service';
import { User } from '../entities';
import { PaymentsService } from './payments.service';

/** Buying a paid theme on the website's /pay page (see PaymentsService). */
@Controller('pay')
export class PaymentsController {
  constructor(private readonly pay: PaymentsService, private readonly catalog: CatalogService) {}

  /** What the pay page shows: the theme, whether the family has it, and how it can be paid for. */
  @Get(':slug')
  @UseGuards(PayGuard)
  async page(@CurrentUser() user: User, @Param('slug') slug: string) {
    const course = await this.pay.theme(slug);
    return {
      theme: this.catalog.card(course), licence: await this.pay.owns(user, course),
      methods: this.pay.methods(course), user: { name: user.name, email: user.email },
    };
  }

  @Post(':slug/razorpay')
  @UseGuards(PayGuard)
  async razorpay(@CurrentUser() user: User, @Param('slug') slug: string) {
    return this.pay.razorpayOrder(user, await this.pay.theme(slug));
  }

  /** Checked with the Razorpay key secret, so it needs no log-in. */
  @Post('razorpay/verify')
  @HttpCode(200)
  verify(@Body() body: Record<string, unknown>) {
    return this.pay.razorpayVerify(body);
  }

  /** Razorpay → here (set it up in the Razorpay dashboard: Settings → Webhooks, events payment.captured and order.paid). */
  @Post('razorpay/webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature = '') {
    return this.pay.razorpayWebhook(req.rawBody, signature);
  }

  @Post(':slug/paypal')
  @UseGuards(PayGuard)
  async paypal(@CurrentUser() user: User, @Param('slug') slug: string, @Req() req: Request & { tokenPurpose?: string; token?: string }) {
    return this.pay.paypalOrder(user, await this.pay.theme(slug), req.tokenPurpose === 'pay' ? req.token : '');
  }

  /** PayPal sent the parent back with the order id. Only an order this API created, and PayPal approved, unlocks anything. */
  @Post('paypal/capture')
  @HttpCode(200)
  capture(@Body() body: { order_id?: string }) {
    return this.pay.paypalCapture(String(body.order_id || ''));
  }
}
