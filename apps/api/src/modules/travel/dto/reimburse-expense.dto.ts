import { IsString, MaxLength } from 'class-validator';

export class ReimburseExpenseDto {
  @IsString()
  @MaxLength(255)
  reimbursementRef!: string;
}
