import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetPurchaseStatus } from '@hrm/types';
import { Employee } from '../employees/employee.entity';
import { Requisition } from '../requisitions/requisition.entity';
import { AssetPurchaseItem } from './asset-purchase-item.entity';

@Entity({ name: 'asset_purchases' })
export class AssetPurchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  vendor!: string;

  @Column({ type: 'varchar', name: 'invoice_no', nullable: true })
  invoiceNo!: string | null;

  @Column({ type: 'date', name: 'invoice_date' })
  invoiceDate!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'total_amount', default: 0 })
  totalAmount!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'uuid', name: 'linked_requisition_id', nullable: true })
  linkedRequisitionId!: string | null;

  @ManyToOne(() => Requisition, { nullable: true })
  @JoinColumn({ name: 'linked_requisition_id' })
  linkedRequisition!: Requisition | null;

  @Column({ type: 'timestamptz', name: 'received_at', nullable: true })
  receivedAt!: Date | null;

  @Column({ type: 'uuid', name: 'received_by', nullable: true })
  receivedBy!: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'received_by' })
  receiver!: Employee | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: AssetPurchaseStatus,
    default: AssetPurchaseStatus.Draft,
  })
  status!: AssetPurchaseStatus;

  @OneToMany(() => AssetPurchaseItem, (item) => item.purchase)
  items!: AssetPurchaseItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
