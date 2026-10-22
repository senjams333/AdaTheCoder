import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Website text the admin edits (table "settings"). */
@Entity('settings')
export class Setting {
  @PrimaryColumn({ length: 60 })
  key!: string;

  @Column({ type: 'text' })
  value!: string;
}
