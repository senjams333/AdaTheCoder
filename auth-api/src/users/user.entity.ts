import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** A parent account (table "users" in admin_db). */
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

  @Column({ length: 80, default: '' })
  city!: string;

  @Column({ length: 80, default: '' })
  country!: string;

  @Column({ name: 'child_name', type: 'varchar', length: 40, nullable: true })
  childName!: string | null;

  @Column({ name: 'child_age', type: 'int', nullable: true })
  childAge!: number | null;

  @Column({ length: 20, default: 'parent' })
  role!: string;

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
    city: u.city,
    country: u.country,
    childName: u.childName,
    childAge: u.childAge,
    role: u.role,
    createdAt: u.createdAt,
  };
}
