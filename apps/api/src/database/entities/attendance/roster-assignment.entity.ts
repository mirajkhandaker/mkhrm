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
import { Roster } from './roster.entity';
import { Shift } from './shift.entity';

@Entity({ name: 'roster_assignments' })
@Unique('UQ_roster_assignments', ['rosterId', 'employeeId', 'workDate'])
export class RosterAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'roster_id' })
  rosterId!: string;

  @ManyToOne(() => Roster)
  @JoinColumn({ name: 'roster_id' })
  roster!: Roster;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee!: Employee;

  @Column({ type: 'uuid', name: 'shift_id' })
  shiftId!: string;

  @ManyToOne(() => Shift)
  @JoinColumn({ name: 'shift_id' })
  shift!: Shift;

  @Column({ type: 'date', name: 'work_date' })
  workDate!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
