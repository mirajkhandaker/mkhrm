import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ExpenseClaim } from './expense-claim.entity';

@Entity({ name: 'expense_items' })
export class ExpenseItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'expense_claim_id' })
  expenseClaimId!: string;

  @ManyToOne(() => ExpenseClaim, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_claim_id' })
  expenseClaim!: ExpenseClaim;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: number;

  @Column({ type: 'date', name: 'spent_on' })
  spentOn!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
