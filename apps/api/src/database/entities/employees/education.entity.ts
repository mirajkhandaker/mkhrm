import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EducationDegree } from '@hrm/types';
import { Employee } from './employee.entity';

@Entity({ name: 'education' })
export class Education {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'enum', enum: EducationDegree })
  degree!: EducationDegree;

  @Column({ type: 'varchar' })
  institution!: string;

  @Column({ type: 'varchar', name: 'field_of_study', nullable: true })
  fieldOfStudy!: string | null;

  @Column({ type: 'varchar', nullable: true })
  result!: string | null;

  @Column({ type: 'int', name: 'start_year', nullable: true })
  startYear!: number | null;

  @Column({ type: 'int', name: 'end_year', nullable: true })
  endYear!: number | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
