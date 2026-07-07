import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApproverType } from '@hrm/types';
import { Workflow } from './workflow.entity';

@Entity({ name: 'workflow_steps' })
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workflow_id' })
  workflowId!: string;

  @ManyToOne(() => Workflow, (w) => w.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow!: Workflow;

  @Column({ type: 'int', name: 'step_order' })
  stepOrder!: number;

  @Column({ type: 'enum', enum: ApproverType, name: 'approver_type' })
  approverType!: ApproverType;

  @Column({ type: 'varchar', name: 'approver_ref', nullable: true })
  approverRef!: string | null;

  @Column({ type: 'boolean', name: 'is_mandatory', default: true })
  isMandatory!: boolean;

  @Column({ type: 'int', name: 'sla_hours', nullable: true })
  slaHours!: number | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'min_metric_value', nullable: true })
  minMetricValue!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'max_metric_value', nullable: true })
  maxMetricValue!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
