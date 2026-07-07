import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProbationStatus } from '@hrm/types';
import { Employee } from './employee.entity';

@Entity({ name: 'probation_records' })
export class ProbationRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'int', name: 'probation_months' })
  probationMonths!: number;

  @Column({ type: 'date', name: 'expected_confirmation_date' })
  expectedConfirmationDate!: string;

  @Column({
    type: 'enum',
    enum: ProbationStatus,
    default: ProbationStatus.InProbation,
  })
  status!: ProbationStatus;

  @Column({ type: 'date', name: 'confirmed_on', nullable: true })
  confirmedOn!: string | null;

  @Column({ type: 'date', name: 'extended_to', nullable: true })
  extendedTo!: string | null;

  @Column({ type: 'uuid', name: 'evaluator_id', nullable: true })
  evaluatorId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
