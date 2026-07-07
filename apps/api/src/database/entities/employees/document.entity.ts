import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { DocumentType } from '@hrm/types';
import { Employee } from './employee.entity';

@Entity({ name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'enum', enum: DocumentType })
  type!: DocumentType;

  @Column({ type: 'varchar', name: 'file_url' })
  fileUrl!: string;

  @Column({ type: 'varchar', name: 'file_name' })
  fileName!: string;

  @Column({ type: 'varchar', name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'int', name: 'file_size_bytes' })
  fileSizeBytes!: number;

  @Column({ type: 'date', name: 'expiry_date', nullable: true })
  expiryDate!: string | null;

  @Column({ type: 'varchar', name: 'label', nullable: true })
  label!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
