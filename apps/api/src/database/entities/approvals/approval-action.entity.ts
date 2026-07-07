import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApprovalAction as ApprovalActionType } from '@hrm/types';
import { Approval } from './approval.entity';

// Append-only — never UPDATE or DELETE rows in this table.
@Entity({ name: 'approval_actions' })
export class ApprovalActionRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'approval_id' })
  approvalId!: string;

  @ManyToOne(() => Approval, (a) => a.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approval_id' })
  approval!: Approval;

  @Column({ type: 'int', name: 'step_order' })
  stepOrder!: number;

  @Column({ type: 'uuid', name: 'actor_id' })
  actorId!: string;

  @Column({ type: 'enum', enum: ApprovalActionType, name: 'action' })
  action!: ApprovalActionType;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'approved_amount', nullable: true })
  approvedAmount!: string | null;

  @CreateDateColumn({ name: 'acted_at', type: 'timestamptz' })
  actedAt!: Date;
}
