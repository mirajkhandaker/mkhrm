import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Index,
} from 'typeorm';
import { AssetHolderType, AssetUnitStatus } from '@hrm/types';
import { AssetCategory } from './asset-category.entity';
import { AssetCondition } from './asset-condition.entity';
import { AssetLocation } from './asset-location.entity';
import { Employee } from '../employees/employee.entity';
import { Department } from '../employees/department.entity';

// The three current_* columns implement a polymorphic holder — exactly one
// non-null at a time — enforced by a DB CHECK constraint. Callers must go
// through the Holder value object (AssetHolderType + id) exposed by the
// service layer; never touch the three columns directly from controllers.
@Check(`(
  (current_holder_type = 'employee'   AND current_employee_id   IS NOT NULL AND current_department_id IS NULL AND current_location_id IS NULL) OR
  (current_holder_type = 'department' AND current_department_id IS NOT NULL AND current_employee_id   IS NULL AND current_location_id IS NULL) OR
  (current_holder_type = 'location'   AND current_location_id   IS NOT NULL AND current_employee_id   IS NULL AND current_department_id IS NULL)
)`)
@Entity({ name: 'asset_units' })
export class AssetUnit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => AssetCategory)
  @JoinColumn({ name: 'category_id' })
  category!: AssetCategory;

  @Index({ unique: true })
  @Column({ type: 'varchar', name: 'asset_tag' })
  assetTag!: string;

  @Column({ type: 'varchar', name: 'serial_no', nullable: true })
  serialNo!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'purchase_cost', default: 0 })
  purchaseCost!: number;

  @Column({ type: 'date', name: 'purchased_on' })
  purchasedOn!: string;

  @Column({ type: 'date', name: 'warranty_until', nullable: true })
  warrantyUntil!: string | null;

  @Column({ type: 'uuid', name: 'condition_id' })
  conditionId!: string;

  @ManyToOne(() => AssetCondition)
  @JoinColumn({ name: 'condition_id' })
  condition!: AssetCondition;

  @Column({
    type: 'enum',
    enum: AssetUnitStatus,
    default: AssetUnitStatus.InStock,
  })
  status!: AssetUnitStatus;

  @Column({ type: 'enum', enum: AssetHolderType, name: 'current_holder_type' })
  currentHolderType!: AssetHolderType;

  @Column({ type: 'uuid', name: 'current_employee_id', nullable: true })
  currentEmployeeId!: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'current_employee_id' })
  currentEmployee!: Employee | null;

  @Column({ type: 'uuid', name: 'current_department_id', nullable: true })
  currentDepartmentId!: string | null;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'current_department_id' })
  currentDepartment!: Department | null;

  @Column({ type: 'uuid', name: 'current_location_id', nullable: true })
  currentLocationId!: string | null;

  @ManyToOne(() => AssetLocation, { nullable: true })
  @JoinColumn({ name: 'current_location_id' })
  currentLocation!: AssetLocation | null;

  @Column({ type: 'date', name: 'current_holder_since' })
  currentHolderSince!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
