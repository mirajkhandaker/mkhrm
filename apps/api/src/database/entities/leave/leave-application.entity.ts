import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeaveApplicationStatus } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { LeaveType } from './leave-type.entity';
import { Approval } from '../approvals/approval.entity';

@Entity({ name: 'leave_applications' })
export class LeaveApplication {
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

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: string;

  @Column({ type: 'numeric', precision: 5, scale: 1, name: 'days_count' })
  daysCount!: number;

  @Column({ type: 'boolean', name: 'is_half_day', default: false })
  isHalfDay!: boolean;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', name: 'document_url', nullable: true })
  documentUrl!: string | null;

  @Column({
    type: 'enum',
    enum: LeaveApplicationStatus,
    default: LeaveApplicationStatus.Draft,
  })
  status!: LeaveApplicationStatus;

  @Column({ type: 'uuid', name: 'approval_id', nullable: true })
  approvalId!: string | null;

  @ManyToOne(() => Approval, { nullable: true })
  @JoinColumn({ name: 'approval_id' })
  approval!: Approval | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
