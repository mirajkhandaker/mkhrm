import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccrualMethod } from '@hrm/types';

@Entity({ name: 'leave_types' })
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'boolean', name: 'is_paid', default: true })
  isPaid!: boolean;

  @Column({ type: 'boolean', name: 'requires_document', default: false })
  requiresDocument!: boolean;

  @Column({
    type: 'enum',
    enum: AccrualMethod,
    name: 'accrual_method',
    default: AccrualMethod.None,
  })
  accrualMethod!: AccrualMethod;

  @Column({ type: 'numeric', precision: 5, scale: 1, name: 'default_days_per_year', default: 0 })
  defaultDaysPerYear!: number;

  @Column({ type: 'numeric', precision: 5, scale: 1, name: 'max_carry_forward', default: 0 })
  maxCarryForward!: number;

  @Column({ type: 'boolean', name: 'allow_negative_balance', default: false })
  allowNegativeBalance!: boolean;

  @Column({ type: 'varchar', default: '#6B8CCF' })
  color!: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
