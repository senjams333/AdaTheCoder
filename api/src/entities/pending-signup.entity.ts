import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** A website sign-up waiting for its email code (table "pending_signups"). The account is made only when
 *  the parent opens the emailed link and types the code. */
@Entity('pending_signups')
export class PendingSignup {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ length: 190 })
  email!: string;

  /** sha256 of the secret in the emailed link */
  @Index({ unique: true })
  @Column({ name: 'link_hash', length: 64 })
  linkHash!: string;

  /** sha256 of "code:link secret" */
  @Column({ name: 'code_hash', length: 64 })
  codeHash!: string;

  /** JSON: name, passwordHash, city, country, childName, childAge */
  @Column({ type: 'text' })
  data!: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
