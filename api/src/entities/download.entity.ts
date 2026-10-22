import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Release } from './release.entity';
import { User } from './user.entity';

/** One app download by a parent (table "downloads"). */
@Entity('downloads')
export class Download {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ name: 'release_id' })
  releaseId!: number;

  @ManyToOne(() => Release, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'release_id' })
  release!: Release;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
