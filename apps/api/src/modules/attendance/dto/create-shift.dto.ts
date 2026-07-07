import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { ShiftType } from '@hrm/types';

export class CreateShiftDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(ShiftType)
  type!: ShiftType;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, { message: 'startTime must be in HH:MM or HH:MM:SS format' })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, { message: 'endTime must be in HH:MM or HH:MM:SS format' })
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  halfDayThresholdMinutes?: number;

  @IsNumber()
  @Min(0)
  workingHours!: number;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(ShiftType)
  type?: ShiftType;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, { message: 'startTime must be in HH:MM or HH:MM:SS format' })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, { message: 'endTime must be in HH:MM or HH:MM:SS format' })
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  halfDayThresholdMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  workingHours?: number;
}
