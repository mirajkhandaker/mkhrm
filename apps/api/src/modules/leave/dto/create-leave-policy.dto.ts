import { IsString, IsNumber, IsUUID, IsOptional, Min } from 'class-validator';

export class CreateLeavePolicyDto {
  @IsUUID()
  leaveTypeId!: string;

  @IsString()
  appliesTo!: string;

  @IsNumber()
  @Min(0)
  daysPerYear!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accrualRate?: number;
}
