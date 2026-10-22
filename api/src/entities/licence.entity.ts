import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Course } from './course.entity';
import { User } from './user.entity';

/** A family's licence for a paid theme (table "user_licences"). */
@Entity('user_licences')
export class Licence {
  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  @PrimaryColumn({ name: 'course_id' })
  courseId!: number;

  @ManyToOne(() => User, (u) => u.licences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @Column({ length: 120 })
  licence!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
