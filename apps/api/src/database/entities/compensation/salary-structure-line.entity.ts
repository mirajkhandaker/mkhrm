import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SalaryCalcType } from '@hrm/types';
import { SalaryComponent } from './salary-component.entity';
import { EmployeeSalaryStructure } from './employee-salary-structure.entity';

@Entity({ name: 'salary_structure_lines' })
export class SalaryStructureLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'salary_structure_id' })
  salaryStructureId!: string;

  @ManyToOne(() => EmployeeSalaryStructure, (structure) => structure.lines)
  @JoinColumn({ name: 'salary_structure_id' })
  salaryStructure!: EmployeeSalaryStructure;

  @Column({ type: 'uuid', name: 'component_id' })
  componentId!: string;

  @ManyToOne(() => SalaryComponent, { eager: true })
  @JoinColumn({ name: 'component_id' })
  component!: SalaryComponent;

  @Column({ type: 'enum', enum: SalaryCalcType, name: 'calc_type' })
  calcType!: SalaryCalcType;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'input_value', nullable: true })
  inputValue!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'computed_amount' })
  computedAmount!: string;
}
