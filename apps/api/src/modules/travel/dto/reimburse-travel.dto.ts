import { IsString, MaxLength } from 'class-validator';

export class ReimburseTravelDto {
  @IsString()
  @MaxLength(255)
  reimbursementRef!: string;
}
