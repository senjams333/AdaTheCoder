import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Course } from './course.entity';

export interface Example {
  label: string;
  explain: string;
  output: string;
  code: string;
}

/** A lesson inside a theme (table "lessons"). */
@Entity('lessons')
@Index(['courseId', 'slug'], { unique: true })
export class Lesson {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'course_id' })
  courseId!: number;

  @ManyToOne(() => Course, (c) => c.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  /** The id the app uses to remember progress, e.g. "lesson1" */
  @Column({ length: 80 })
  slug!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  /** Topic emoji in the app's lesson list */
  @Column({ length: 16, default: '' })
  emoji!: string;

  /** Topic name in the app's lesson list, e.g. PRINT HELLO */
  @Column({ length: 120 })
  name!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ length: 255, default: '' })
  subtitle!: string;

  /** A video shipped inside the app, e.g. vid/video1.mp4 */
  @Column({ name: 'video_bundled', length: 190, default: '' })
  videoBundled!: string;

  /** A video uploaded in the admin (wins over the bundled one) */
  @Column({ name: 'video_file', length: 190, default: '' })
  videoFile!: string;

  @Column({ name: 'video_size', type: 'bigint', default: 0 })
  videoSize!: string | number;

  @Column({ name: 'default_code', type: 'text' })
  defaultCode!: string;

  @Column({ type: 'simple-json' })
  examples!: Example[];

  @Column({ default: true })
  published!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
