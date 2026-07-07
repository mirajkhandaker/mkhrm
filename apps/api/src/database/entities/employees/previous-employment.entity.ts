import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';

@Entity({ name: 'previous_employments' })
export class PreviousEmployment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'varchar', name: 'company_name' })
  companyName!: string;

  @Column({ type: 'varchar', nullable: true })
  designation!: string | null;

  @Column({ type: 'date', name: 'from_date' })
  fromDate!: string;

  @Column({ type: 'date', name: 'to_date', nullable: true })
  toDate!: string | null;

  @Column({ type: 'text', name: 'reason_for_leaving', nullable: true })
  reasonForLeaving!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
