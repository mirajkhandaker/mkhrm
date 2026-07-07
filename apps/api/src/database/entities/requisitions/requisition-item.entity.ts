import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Requisition } from './requisition.entity';

@Entity({ name: 'requisition_items' })
export class RequisitionItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'requisition_id' })
  requisitionId!: string;

  @ManyToOne(() => Requisition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requisition_id' })
  requisition!: Requisition;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'unit_cost' })
  unitCost!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
