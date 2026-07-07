import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApprovalEntityType } from '@hrm/types';
import { WorkflowStep } from './workflow-step.entity';

@Entity({ name: 'workflows' })
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'enum', enum: ApprovalEntityType, name: 'entity_type' })
  entityType!: ApprovalEntityType;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => WorkflowStep, (step) => step.workflow, { cascade: true, eager: false })
  steps!: WorkflowStep[];
}
