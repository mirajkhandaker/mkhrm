import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InputBasis } from '@hrm/types';

@Entity({ name: 'salary_grades' })
export class SalaryGrade {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'enum', enum: InputBasis, name: 'basic_definition' })
  basicDefinition!: InputBasis;

  @Column({ type: 'jsonb', nullable: true })
  rules!: Record<string, { calcType: string; value: number }> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
