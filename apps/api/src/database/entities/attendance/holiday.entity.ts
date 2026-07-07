import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { HolidayType } from '@hrm/types';

@Entity({ name: 'holidays' })
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'enum', enum: HolidayType })
  type!: HolidayType;

  @Column({ type: 'boolean', name: 'is_recurring', default: false })
  isRecurring!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
