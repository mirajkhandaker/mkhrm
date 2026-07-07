import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { LeaveLedgerSource } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { LeaveType } from './leave-type.entity';

@Entity({ name: 'leave_ledger' })
export class LeaveLedger {
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

  @Column({ type: 'numeric', precision: 6, scale: 1 })
  change!: number;

  @Column({ type: 'numeric', precision: 6, scale: 1, name: 'balance_after' })
  balanceAfter!: number;

  @Column({ type: 'enum', enum: LeaveLedgerSource })
  source!: LeaveLedgerSource;

  @Column({ type: 'uuid', name: 'ref_id', nullable: true })
  refId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
