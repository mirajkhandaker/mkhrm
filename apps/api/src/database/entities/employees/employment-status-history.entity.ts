import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { EmploymentStatus, EmploymentStatusChangeRef } from '@hrm/types';
import { Employee } from './employee.entity';

@Entity({ name: 'employment_status_history' })
export class EmploymentStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'enum', enum: EmploymentStatus, name: 'from_status', nullable: true })
  fromStatus!: EmploymentStatus | null;

  @Column({ type: 'enum', enum: EmploymentStatus, name: 'to_status' })
  toStatus!: EmploymentStatus;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'enum', enum: EmploymentStatusChangeRef, name: 'ref_type', nullable: true })
  refType!: EmploymentStatusChangeRef | null;

  @Column({ type: 'uuid', name: 'ref_id', nullable: true })
  refId!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
