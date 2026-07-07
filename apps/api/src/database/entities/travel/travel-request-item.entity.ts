import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { TravelTransportMode, TravelCostCategory } from '@hrm/types';
import { TravelRequest } from './travel-request.entity';

@Entity({ name: 'travel_request_items' })
export class TravelRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'travel_request_id' })
  travelRequestId!: string;

  @ManyToOne(() => TravelRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'travel_request_id' })
  travelRequest!: TravelRequest;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    type: 'enum',
    enum: TravelCostCategory,
    default: TravelCostCategory.Travel,
  })
  category!: TravelCostCategory;

  @Column({
    type: 'enum',
    enum: TravelTransportMode,
    name: 'transport_mode',
    nullable: true,
  })
  transportMode!: TravelTransportMode | null;

  // Only meaningful when category = Travel (Transport) — the route this leg covers.
  @Column({ type: 'varchar', name: 'from_location', nullable: true })
  fromLocation!: string | null;

  @Column({ type: 'varchar', name: 'to_location', nullable: true })
  toLocation!: string | null;

  @Column({ type: 'boolean', name: 'is_round_trip', default: false })
  isRoundTrip!: boolean;

  @Column({ type: 'date', name: 'travel_date_from' })
  fromDate!: string;

  @Column({ type: 'date', name: 'travel_date_to' })
  toDate!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'estimated_cost' })
  estimatedCost!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'actual_cost', nullable: true })
  actualCost!: number | null;

  @Column({ type: 'boolean', name: 'is_planned', default: true })
  isPlanned!: boolean;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
