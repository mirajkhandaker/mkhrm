import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TravelRequestStatus, TravelSettlementStatus, TravelRequestTiming } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { Approval } from '../approvals/approval.entity';
import { TravelRequestItem } from './travel-request-item.entity';

@Entity({ name: 'travel_requests' })
export class TravelRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'varchar' })
  purpose!: string;

  @Column({
    type: 'enum',
    enum: TravelRequestTiming,
    default: TravelRequestTiming.PreTrip,
  })
  timing!: TravelRequestTiming;

  @Column({ type: 'date', name: 'from_date' })
  fromDate!: string;

  @Column({ type: 'date', name: 'to_date' })
  toDate!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'estimated_cost', default: 0 })
  estimatedCost!: number;

  @OneToMany(() => TravelRequestItem, (item) => item.travelRequest)
  items!: TravelRequestItem[];

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'advance_requested', default: 0 })
  advanceRequested!: number;

  @Column({
    type: 'enum',
    enum: TravelRequestStatus,
    default: TravelRequestStatus.Pending,
  })
  status!: TravelRequestStatus;

  @Column({ type: 'uuid', name: 'approval_id', nullable: true })
  approvalId!: string | null;

  @ManyToOne(() => Approval, { nullable: true })
  @JoinColumn({ name: 'approval_id' })
  approval!: Approval | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'approved_advance_amount', nullable: true })
  approvedAdvanceAmount!: number | null;

  @Column({
    type: 'enum',
    enum: TravelSettlementStatus,
    name: 'settlement_status',
    default: TravelSettlementStatus.None,
  })
  settlementStatus!: TravelSettlementStatus;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'actual_cost', nullable: true })
  actualCost!: number | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'net_adjustment', nullable: true })
  netAdjustment!: number | null;

  @Column({ type: 'timestamptz', name: 'settlement_locked_at', nullable: true })
  settlementLockedAt!: Date | null;

  @Column({ type: 'uuid', name: 'settlement_locked_by', nullable: true })
  settlementLockedBy!: string | null;

  // Only set for post-trip requests, once Finance marks the approved amount paid out.
  @Column({ type: 'timestamptz', name: 'reimbursed_at', nullable: true })
  reimbursedAt!: Date | null;

  @Column({ type: 'varchar', name: 'reimbursement_ref', nullable: true })
  reimbursementRef!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
