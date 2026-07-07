import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { AssetCategory } from './asset-category.entity';
import { AssetLocation } from './asset-location.entity';

// Per-(category, location) quantity for consumable-tracking categories only.
// Serialized categories never touch this table; they live in asset_units.
@Unique(['categoryId', 'locationId'])
@Entity({ name: 'asset_stock' })
export class AssetStock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => AssetCategory)
  @JoinColumn({ name: 'category_id' })
  category!: AssetCategory;

  @Column({ type: 'uuid', name: 'location_id' })
  locationId!: string;

  @ManyToOne(() => AssetLocation)
  @JoinColumn({ name: 'location_id' })
  location!: AssetLocation;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  @Column({ type: 'int', name: 'min_quantity', nullable: true })
  minQuantity!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
