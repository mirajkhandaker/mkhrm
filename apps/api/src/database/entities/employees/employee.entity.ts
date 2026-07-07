import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import {
  EmploymentType,
  EmploymentStatus,
  EmployeeStatus,
  Gender,
} from '@hrm/types';
import { User } from '../auth/user.entity';
import { Department } from './department.entity';
import { Designation } from './designation.entity';

@Entity({ name: 'employees' })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', name: 'employee_code', unique: true })
  employeeCode!: string;

  @Column({ type: 'varchar', name: 'device_user_id', nullable: true })
  deviceUserId!: string | null;

  @Column({ type: 'varchar', name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', name: 'last_name' })
  lastName!: string;

  @Column({ type: 'date', nullable: true })
  dob!: string | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender!: Gender | null;

  @Column({ type: 'varchar', name: 'personal_email', nullable: true })
  personalEmail!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', name: 'photo_url', nullable: true })
  photoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'jsonb', name: 'emergency_contact', nullable: true })
  emergencyContact!: Record<string, string> | null;

  @Column({ type: 'date', name: 'join_date' })
  joinDate!: string;

  @Column({ type: 'enum', enum: EmploymentType, name: 'employment_type' })
  employmentType!: EmploymentType;

  @Column({
    type: 'enum',
    enum: EmploymentStatus,
    name: 'employment_status',
    default: EmploymentStatus.Probation,
  })
  employmentStatus!: EmploymentStatus;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.Active,
  })
  status!: EmployeeStatus;

  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department!: Department | null;

  @Column({ type: 'uuid', name: 'designation_id', nullable: true })
  designationId!: string | null;

  @ManyToOne(() => Designation, { nullable: true })
  @JoinColumn({ name: 'designation_id' })
  designation!: Designation | null;

  @Column({ type: 'uuid', name: 'line_manager_id', nullable: true })
  lineManagerId!: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'line_manager_id' })
  lineManager!: Employee | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
