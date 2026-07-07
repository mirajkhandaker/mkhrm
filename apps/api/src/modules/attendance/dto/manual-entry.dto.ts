import { IsUUID, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ManualEntryDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
