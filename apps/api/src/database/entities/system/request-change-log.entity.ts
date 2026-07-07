import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ChangeEntityType } from '@hrm/types';
import { User } from '../auth/user.entity';

// Append-only — never UPDATE or DELETE rows in this table.
@Entity({ name: 'request_change_logs' })
export class RequestChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ChangeEntityType, name: 'entity_type' })
  entityType!: ChangeEntityType;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'uuid', name: 'changed_by' })
  changedBy!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'changed_by' })
  changedByUser!: User;

  @Column({ type: 'text', name: 'change_summary' })
  changeSummary!: string;

  @Column({ type: 'jsonb', nullable: true })
  diff!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
