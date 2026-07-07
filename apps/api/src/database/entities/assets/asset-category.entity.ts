import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetTrackingMode, DepreciationMethod } from '@hrm/types';

@Entity({ name: 'asset_categories' })
export class AssetCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'enum', enum: AssetTrackingMode, name: 'tracking_mode' })
  trackingMode!: AssetTrackingMode;

  @Column({
    type: 'enum',
    enum: DepreciationMethod,
    name: 'depreciation_method',
    default: DepreciationMethod.None,
  })
  depreciationMethod!: DepreciationMethod;

  @Column({ type: 'int', name: 'useful_life_months', nullable: true })
  usefulLifeMonths!: number | null;

  @Column({ type: 'int', name: 'default_warranty_months', nullable: true })
  defaultWarrantyMonths!: number | null;

  @Column({ type: 'boolean', name: 'requires_asset_tag', default: true })
  requiresAssetTag!: boolean;

  @Column({ type: 'int', name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
