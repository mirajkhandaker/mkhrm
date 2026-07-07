import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ShiftType } from '@hrm/types';

@Entity({ name: 'shifts' })
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'enum', enum: ShiftType })
  type!: ShiftType;

  @Column({ type: 'time', name: 'start_time' })
  startTime!: string;

  @Column({ type: 'time', name: 'end_time' })
  endTime!: string;

  @Column({ type: 'int', name: 'grace_minutes', default: 0 })
  graceMinutes!: number;

  @Column({ type: 'int', name: 'half_day_threshold_minutes', default: 240 })
  halfDayThresholdMinutes!: number;

  @Column({ type: 'numeric', precision: 4, scale: 1, name: 'working_hours' })
  workingHours!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
