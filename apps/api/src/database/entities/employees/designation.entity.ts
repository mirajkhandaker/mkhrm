import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from './department.entity';

@Entity({ name: 'designations' })
export class Designation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'int', nullable: true })
  level!: number | null;

  // Designations belong to a department (nullable so pre-existing / org-wide
  // titles remain valid). The UI groups and filters titles by department.
  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department!: Department | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
