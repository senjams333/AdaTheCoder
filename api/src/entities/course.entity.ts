import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Lesson } from './lesson.entity';

export interface CharacterPicture {
  name: string;
  file: string;
}

/** A theme (table "courses"): its own lessons, characters and price. */
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn()
  id!: number;

  /** The id the desktop app uses, e.g. "friends" */
  @Index({ unique: true })
  @Column({ length: 60 })
  slug!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 255, default: '' })
  tagline!: string;

  @Column({ type: 'text' })
  description!: string;

  /** One selling point per line */
  @Column({ type: 'text' })
  features!: string;

  /** Character pack: friends, fairies, coding_club or custom */
  @Column({ length: 30, default: 'friends' })
  pack!: string;

  @Column({ length: 30, default: '' })
  price!: string;

  @Column({ default: false })
  premium!: boolean;

  @Column({ name: 'image_file', length: 190, default: '' })
  imageFile!: string;

  @Column({ name: 'free_lessons', type: 'int', default: 3 })
  freeLessons!: number;

  /** pack "custom": the uploaded characters */
  @Column({ type: 'simple-json' })
  characters!: CharacterPicture[];

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ default: true })
  published!: boolean;

  @OneToMany(() => Lesson, (l) => l.course)
  lessons!: Lesson[];

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
