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
import { RequisitionType, RequisitionPriority, RequisitionStatus } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { Approval } from '../approvals/approval.entity';
import { RequisitionItem } from './requisition-item.entity';

@Entity({ name: 'requisitions' })
export class Requisition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'requester_id' })
  requesterId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'requester_id' })
  requester!: Employee;

  @Column({ type: 'enum', enum: RequisitionType })
  type!: RequisitionType;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: RequisitionPriority,
    default: RequisitionPriority.Medium,
  })
  priority!: RequisitionPriority;

  @Column({ type: 'date', name: 'needed_by', nullable: true })
  neededBy!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'estimated_cost', default: 0 })
  estimatedCost!: number;

  @Column({
    type: 'enum',
    enum: RequisitionStatus,
    default: RequisitionStatus.Pending,
  })
  status!: RequisitionStatus;

  @Column({ type: 'uuid', name: 'approval_id', nullable: true })
  approvalId!: string | null;

  @ManyToOne(() => Approval, { nullable: true })
  @JoinColumn({ name: 'approval_id' })
  approval!: Approval | null;

  @OneToMany(() => RequisitionItem, (item) => item.requisition)
  items!: RequisitionItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
