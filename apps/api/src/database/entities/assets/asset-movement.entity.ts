import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AssetHolderType, AssetMovementType } from '@hrm/types';
import { AssetUnit } from './asset-unit.entity';
import { AssetCategory } from './asset-category.entity';
import { Employee } from '../employees/employee.entity';

// Append-only ledger of every physical change to an asset — assignments,
// returns, transfers, consumable issues, maintenance, retirement. Never
// UPDATE or DELETE a row here.
//
// - unit_id set for serialized-item events (assign, return, etc.).
// - category_id set for consumable events (issue_consumable, stock_in).
// - from/to holder columns follow the same trio pattern as asset_units.
@Entity({ name: 'asset_movements' })
export class AssetMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'unit_id', nullable: true })
  unitId!: string | null;

  @ManyToOne(() => AssetUnit, { nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit!: AssetUnit | null;

  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => AssetCategory, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category!: AssetCategory | null;

  @Column({ type: 'enum', enum: AssetMovementType, name: 'movement_type' })
  movementType!: AssetMovementType;

  @Column({ type: 'enum', enum: AssetHolderType, name: 'from_holder_type', nullable: true })
  fromHolderType!: AssetHolderType | null;

  @Column({ type: 'uuid', name: 'from_holder_id', nullable: true })
  fromHolderId!: string | null;

  @Column({ type: 'enum', enum: AssetHolderType, name: 'to_holder_type', nullable: true })
  toHolderType!: AssetHolderType | null;

  @Column({ type: 'uuid', name: 'to_holder_id', nullable: true })
  toHolderId!: string | null;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'varchar', nullable: true })
  reference!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', name: 'performed_by' })
  performedBy!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'performed_by' })
  performer!: Employee;

  @CreateDateColumn({ name: 'performed_at', type: 'timestamptz' })
  performedAt!: Date;
}
