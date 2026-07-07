import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ImportType, ImportBatchStatus } from '@hrm/types';
import { User } from '../auth/user.entity';

@Entity({ name: 'import_batches' })
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ImportType, default: ImportType.Attendance })
  type!: ImportType;

  @Column({ type: 'varchar', name: 'file_name' })
  fileName!: string;

  @Column({ type: 'varchar', name: 'file_url' })
  fileUrl!: string;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader!: User;

  @Column({
    type: 'enum',
    enum: ImportBatchStatus,
    default: ImportBatchStatus.Uploaded,
  })
  status!: ImportBatchStatus;

  @Column({ type: 'int', name: 'total_rows', default: 0 })
  totalRows!: number;

  @Column({ type: 'int', name: 'success_rows', default: 0 })
  successRows!: number;

  @Column({ type: 'int', name: 'error_rows', default: 0 })
  errorRows!: number;

  @Column({ type: 'jsonb', name: 'column_mapping', nullable: true })
  columnMapping!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
