import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { AttendanceSource, AttendanceStatus } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { User } from '../auth/user.entity';
import { ImportBatch } from './import-batch.entity';

@Entity({ name: 'attendance_records' })
@Unique('UQ_attendance_records_employee_date', ['employeeId', 'workDate'])
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'date', name: 'work_date' })
  workDate!: string;

  @Column({ type: 'timestamptz', name: 'check_in_at', nullable: true })
  checkInAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'check_out_at', nullable: true })
  checkOutAt!: Date | null;

  @Column({ type: 'enum', enum: AttendanceSource })
  source!: AttendanceSource;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status!: AttendanceStatus;

  @Column({ type: 'int', name: 'late_minutes', default: 0 })
  lateMinutes!: number;

  @Column({ type: 'int', name: 'early_leave_minutes', default: 0 })
  earlyLeaveMinutes!: number;

  @Column({ type: 'int', name: 'worked_minutes', default: 0 })
  workedMinutes!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', name: 'import_batch_id', nullable: true })
  importBatchId!: string | null;

  @ManyToOne(() => ImportBatch, { nullable: true })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch!: ImportBatch | null;

  @Column({ type: 'uuid', name: 'regularized_by', nullable: true })
  regularizedBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'regularized_by' })
  regularizedByUser!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
