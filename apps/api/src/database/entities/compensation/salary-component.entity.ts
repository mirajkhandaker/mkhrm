import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SalaryComponentType, SalaryCalcType } from '@hrm/types';

@Entity({ name: 'salary_components' })
export class SalaryComponent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'enum', enum: SalaryComponentType })
  type!: SalaryComponentType;

  @Column({ type: 'enum', enum: SalaryCalcType, name: 'calc_type' })
  calcType!: SalaryCalcType;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'default_value', nullable: true })
  defaultValue!: string | null;

  @Column({ type: 'boolean', name: 'is_pf_applicable', default: false })
  isPfApplicable!: boolean;

  @Column({ type: 'boolean', name: 'is_taxable', default: false })
  isTaxable!: boolean;

  @Column({ type: 'int', name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
