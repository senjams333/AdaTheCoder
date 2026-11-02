import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** One try at buying a theme (table "payments"): created when the parent picks Razorpay or PayPal,
 *  "paid" once the payment provider confirms it (then the family gets the theme's licence). */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'course_id' })
  courseId!: number;

  /** "razorpay" or "paypal" */
  @Column({ length: 20 })
  provider!: string;

  /** The provider's order id (Razorpay order_..., PayPal order id) */
  @Index({ unique: true })
  @Column({ name: 'order_id', length: 80 })
  orderId!: string;

  /** In the smallest unit: paise for INR, cents for USD */
  @Column({ type: 'int' })
  amount!: number;

  @Column({ length: 3 })
  currency!: string;

  /** created · paid · failed */
  @Column({ length: 12, default: 'created' })
  status!: string;

  /** The provider's payment / capture id, once paid */
  @Column({ name: 'payment_id', length: 80, default: '' })
  paymentId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
