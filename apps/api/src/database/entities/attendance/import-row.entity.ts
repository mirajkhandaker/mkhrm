import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ImportRowStatus } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { ImportBatch } from './import-batch.entity';

@Entity({ name: 'import_rows' })
export class ImportRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'import_batch_id' })
  importBatchId!: string;

  @ManyToOne(() => ImportBatch)
  @JoinColumn({ name: 'import_batch_id' })
  importBatch!: ImportBatch;

  @Column({ type: 'int', name: 'row_number' })
  rowNumber!: number;

  @Column({ type: 'jsonb' })
  raw!: unknown;

  @Column({ type: 'uuid', name: 'matched_employee_id', nullable: true })
  matchedEmployeeId!: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'matched_employee_id' })
  matchedEmployee!: Employee | null;

  @Column({ type: 'jsonb', nullable: true })
  parsed!: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: ImportRowStatus })
  status!: ImportRowStatus;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
