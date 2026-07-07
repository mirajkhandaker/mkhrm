import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { LeaveType } from './leave-type.entity';

@Entity({ name: 'leave_policies' })
export class LeavePolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'leave_type_id' })
  leaveTypeId!: string;

  @ManyToOne(() => LeaveType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_type_id' })
  leaveType!: LeaveType;

  @Column({ type: 'varchar', name: 'applies_to' })
  appliesTo!: string;

  @Column({ type: 'numeric', precision: 5, scale: 1, name: 'days_per_year', default: 0 })
  daysPerYear!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'accrual_rate', nullable: true })
  accrualRate!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
