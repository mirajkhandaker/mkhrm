import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RegularizationStatus } from '@hrm/types';
import { AttendanceRecord } from './attendance-record.entity';
import { Employee } from '../employees/employee.entity';
import { Approval } from '../approvals/approval.entity';

@Entity({ name: 'attendance_regularizations' })
export class AttendanceRegularization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'attendance_record_id' })
  attendanceRecordId!: string;

  @ManyToOne(() => AttendanceRecord)
  @JoinColumn({ name: 'attendance_record_id' })
  attendanceRecord!: AttendanceRecord;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'uuid', name: 'requested_by' })
  requestedBy!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'requested_by' })
  requester!: Employee;

  @Column({
    type: 'enum',
    enum: RegularizationStatus,
    default: RegularizationStatus.Pending,
  })
  status!: RegularizationStatus;

  @Column({ type: 'uuid', name: 'approval_id', nullable: true })
  approvalId!: string | null;

  @ManyToOne(() => Approval, { nullable: true })
  @JoinColumn({ name: 'approval_id' })
  approval!: Approval | null;

  @Column({ type: 'timestamptz', name: 'requested_check_in_at', nullable: true })
  requestedCheckInAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'requested_check_out_at', nullable: true })
  requestedCheckOutAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
