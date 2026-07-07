import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApprovalEntityType, ApprovalStatus } from '@hrm/types';
import { ApprovalActionRecord } from './approval-action.entity';
import { Workflow } from './workflow.entity';
import { User } from '../auth/user.entity';

@Entity({ name: 'approvals' })
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workflow_id' })
  workflowId!: string;

  @ManyToOne(() => Workflow, { nullable: false })
  @JoinColumn({ name: 'workflow_id' })
  workflow!: Workflow;

  @Column({ type: 'enum', enum: ApprovalEntityType, name: 'entity_type' })
  entityType!: ApprovalEntityType;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'int', name: 'current_step', default: 1 })
  currentStep!: number;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.Pending,
  })
  status!: ApprovalStatus;

  @Column({ type: 'uuid', name: 'requested_by' })
  requestedBy!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'metric_value', nullable: true })
  metricValue!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'approved_amount', nullable: true })
  approvedAmount!: string | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'requested_by' })
  requester!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ApprovalActionRecord, (a) => a.approval, { eager: false })
  actions!: ApprovalActionRecord[];
}
