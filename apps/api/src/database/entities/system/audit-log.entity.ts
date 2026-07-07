import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor!: User | null;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar', name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'varchar', name: 'entity_id', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  diff!: unknown;

  @Column({ type: 'varchar', nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
