import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AssetPurchase } from './asset-purchase.entity';
import { AssetCategory } from './asset-category.entity';
import { AssetLocation } from './asset-location.entity';

@Entity({ name: 'asset_purchase_items' })
export class AssetPurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'purchase_id' })
  purchaseId!: string;

  @ManyToOne(() => AssetPurchase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase!: AssetPurchase;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => AssetCategory)
  @JoinColumn({ name: 'category_id' })
  category!: AssetCategory;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'unit_cost' })
  unitCost!: number;

  @Column({ type: 'int', name: 'warranty_months', nullable: true })
  warrantyMonths!: number | null;

  @Column({ type: 'uuid', name: 'location_id' })
  locationId!: string;

  @ManyToOne(() => AssetLocation)
  @JoinColumn({ name: 'location_id' })
  location!: AssetLocation;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
