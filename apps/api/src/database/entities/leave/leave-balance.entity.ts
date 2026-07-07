import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { LeaveType } from './leave-type.entity';

@Entity({ name: 'leave_balances' })
@Index(['employeeId', 'leaveTypeId', 'year'], { unique: true })
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'uuid', name: 'leave_type_id' })
  leaveTypeId!: string;

  @ManyToOne(() => LeaveType)
  @JoinColumn({ name: 'leave_type_id' })
  leaveType!: LeaveType;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'numeric', precision: 6, scale: 1, default: 0 })
  entitled!: number;

  @Column({ type: 'numeric', precision: 6, scale: 1, default: 0 })
  accrued!: number;

  @Column({ type: 'numeric', precision: 6, scale: 1, default: 0 })
  used!: number;

  @Column({ type: 'numeric', precision: 6, scale: 1, default: 0 })
  pending!: number;

  @Column({ type: 'numeric', precision: 6, scale: 1, name: 'carried_forward', default: 0 })
  carriedForward!: number;

  @Column({ type: 'numeric', precision: 6, scale: 1, default: 0 })
  available!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
