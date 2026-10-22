import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Licence } from './licence.entity';

/** A parent or an admin (table "users"). */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ length: 190 })
  email!: string;

  @Column({ length: 80 })
  name!: string;

  @Column({ name: 'password_hash', length: 100 })
  passwordHash!: string;

  /** "parent" or "admin" */
  @Column({ length: 20, default: 'parent' })
  role!: string;

  @Column({ length: 80, default: '' })
  city!: string;

  @Column({ length: 80, default: '' })
  country!: string;

  @Column({ name: 'child_name', type: 'varchar', length: 40, nullable: true })
  childName!: string | null;

  @Column({ name: 'child_age', type: 'int', nullable: true })
  childAge!: number | null;

  /** "free" or "premium" (set by the admin) */
  @Column({ length: 20, default: 'free' })
  plan!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login', type: 'datetime', nullable: true })
  lastLogin!: Date | null;

  @OneToMany(() => Licence, (l) => l.user)
  licences!: Licence[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

/** What the API sends back about a user (never the password hash). */
export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    city: u.city,
    country: u.country,
    childName: u.childName,
    childAge: u.childAge,
    plan: u.plan,
    isActive: u.isActive,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
  };
}
