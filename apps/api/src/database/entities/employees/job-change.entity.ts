import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { JobChangeType } from '@hrm/types';
import { Employee } from './employee.entity';

@Entity({ name: 'job_changes' })
export class JobChange {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'enum', enum: JobChangeType })
  type!: JobChangeType;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate!: string;

  @Column({ type: 'uuid', name: 'from_department_id', nullable: true })
  fromDepartmentId!: string | null;

  @Column({ type: 'uuid', name: 'to_department_id', nullable: true })
  toDepartmentId!: string | null;

  @Column({ type: 'uuid', name: 'from_designation_id', nullable: true })
  fromDesignationId!: string | null;

  @Column({ type: 'uuid', name: 'to_designation_id', nullable: true })
  toDesignationId!: string | null;

  @Column({ type: 'uuid', name: 'from_manager_id', nullable: true })
  fromManagerId!: string | null;

  @Column({ type: 'uuid', name: 'to_manager_id', nullable: true })
  toManagerId!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
