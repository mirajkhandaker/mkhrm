import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { InputBasis, SalaryStructureStatus, SalaryRevisionReason } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { SalaryStructureLine } from './salary-structure-line.entity';

@Entity({ name: 'employee_salary_structures' })
export class EmployeeSalaryStructure {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom!: string;

  @Column({ type: 'date', name: 'effective_to', nullable: true })
  effectiveTo!: string | null;

  @Column({ type: 'enum', enum: InputBasis, name: 'input_basis' })
  inputBasis!: InputBasis;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'input_amount' })
  inputAmount!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'basic_amount' })
  basicAmount!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'gross_amount' })
  grossAmount!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'ctc_amount' })
  ctcAmount!: string;

  @Column({ type: 'varchar', default: 'BDT' })
  currency!: string;

  @Column({ type: 'enum', enum: SalaryRevisionReason })
  reason!: SalaryRevisionReason;

  @Column({
    type: 'enum',
    enum: SalaryStructureStatus,
    default: SalaryStructureStatus.Draft,
  })
  status!: SalaryStructureStatus;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => SalaryStructureLine, (line) => line.salaryStructure, {
    cascade: ['insert'],
    eager: true,
  })
  lines!: SalaryStructureLine[];
}
