import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PfBase, PfStatus } from '@hrm/types';
import { Employee } from '../employees/employee.entity';

@Entity({ name: 'pf_accounts' })
export class PfAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'varchar', name: 'pf_number', nullable: true })
  pfNumber!: string | null;

  @Column({ type: 'date', name: 'enrolled_on' })
  enrolledOn!: string;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    name: 'employee_contrib_percent',
    default: 10,
  })
  employeeContribPercent!: string;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    name: 'employer_contrib_percent',
    default: 10,
  })
  employerContribPercent!: string;

  @Column({ type: 'enum', enum: PfBase, name: 'pf_base', default: PfBase.Basic })
  pfBase!: PfBase;

  @Column({ type: 'enum', enum: PfStatus, default: PfStatus.Active })
  status!: PfStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
