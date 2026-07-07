import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Shift } from './shift.entity';

@Entity({ name: 'schedules' })
@Unique('UQ_schedules_employee_date', ['employeeId', 'workDate'])
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'uuid', name: 'shift_id', nullable: true })
  shiftId!: string | null;

  @ManyToOne(() => Shift, { nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift!: Shift | null;

  @Column({ type: 'date', name: 'work_date' })
  workDate!: string;

  @Column({ type: 'boolean', name: 'is_weekend', default: false })
  isWeekend!: boolean;

  @Column({ type: 'boolean', name: 'is_holiday', default: false })
  isHoliday!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
