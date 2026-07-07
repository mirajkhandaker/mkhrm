import { IsUUID, IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class CreateRegularizationDto {
  @IsUUID()
  attendanceRecordId!: string;

  @IsString()
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  requestedCheckInAt?: string;

  @IsOptional()
  @IsDateString()
  requestedCheckOutAt?: string;
}
