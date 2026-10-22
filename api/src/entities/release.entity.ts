import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** An app installer uploaded in the admin (table "releases"). */
@Entity('releases')
@Index(['platform', 'version'], { unique: true })
export class Release {
  @PrimaryGeneratedColumn()
  id!: number;

  /** "windows" or "mac" */
  @Column({ length: 20 })
  platform!: string;

  @Column({ length: 20 })
  version!: string;

  @Column({ type: 'text' })
  notes!: string;

  /** Name on disk (uploads/releases) */
  @Column({ length: 190 })
  filename!: string;

  /** Name parents see when they download */
  @Column({ name: 'original_name', length: 190 })
  originalName!: string;

  @Column({ type: 'bigint', default: 0 })
  size!: string | number;

  @Column({ name: 'min_supported', length: 20, default: '' })
  minSupported!: string;

  @Column({ name: 'is_latest', default: false })
  isLatest!: boolean;

  @Column({ type: 'int', default: 0 })
  downloads!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
