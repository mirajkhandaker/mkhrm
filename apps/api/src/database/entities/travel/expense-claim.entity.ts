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
import { ExpenseClaimStatus } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { Approval } from '../approvals/approval.entity';
import { TravelRequest } from './travel-request.entity';
import { ExpenseItem } from './expense-item.entity';

@Entity({ name: 'expense_claims' })
export class ExpenseClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'uuid', name: 'travel_request_id', nullable: true })
  travelRequestId!: string | null;

  @ManyToOne(() => TravelRequest, { nullable: true })
  @JoinColumn({ name: 'travel_request_id' })
  travelRequest!: TravelRequest | null;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'total_amount', default: 0 })
  totalAmount!: number;

  @Column({ type: 'varchar', default: 'BDT' })
  currency!: string;

  @Column({
    type: 'enum',
    enum: ExpenseClaimStatus,
    default: ExpenseClaimStatus.Pending,
  })
  status!: ExpenseClaimStatus;

  @Column({ type: 'uuid', name: 'approval_id', nullable: true })
  approvalId!: string | null;

  @ManyToOne(() => Approval, { nullable: true })
  @JoinColumn({ name: 'approval_id' })
  approval!: Approval | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'approved_amount', nullable: true })
  approvedAmount!: number | null;

  @Column({ type: 'timestamptz', name: 'reimbursed_at', nullable: true })
  reimbursedAt!: Date | null;

  @Column({ type: 'varchar', name: 'reimbursement_ref', nullable: true })
  reimbursementRef!: string | null;

  @OneToMany(() => ExpenseItem, (item) => item.expenseClaim)
  items!: ExpenseItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
