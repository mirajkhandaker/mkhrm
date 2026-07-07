import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AssetMaintenanceOutcome } from '@hrm/types';
import { AssetUnit } from './asset-unit.entity';
import { Employee } from '../employees/employee.entity';

@Entity({ name: 'asset_maintenance_records' })
export class AssetMaintenanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'unit_id' })
  unitId!: string;

  @ManyToOne(() => AssetUnit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit!: AssetUnit;

  @Column({ type: 'timestamptz', name: 'started_at' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  cost!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'varchar', nullable: true })
  vendor!: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: AssetMaintenanceOutcome,
    nullable: true,
  })
  outcome!: AssetMaintenanceOutcome | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'created_by' })
  creator!: Employee;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
