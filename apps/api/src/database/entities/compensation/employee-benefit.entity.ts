import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BenefitType, BenefitValueType } from '@hrm/types';
import { Employee } from '../employees/employee.entity';

@Entity({ name: 'employee_benefits' })
export class EmployeeBenefit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'enum', enum: BenefitType })
  type!: BenefitType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: BenefitValueType, name: 'value_type' })
  valueType!: BenefitValueType;

  @Column({ type: 'varchar' })
  value!: string;

  @Column({ type: 'date', name: 'effective_from' })
  effectiveFrom!: string;

  @Column({ type: 'date', name: 'effective_to', nullable: true })
  effectiveTo!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
