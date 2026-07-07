import { IsString, IsEnum, IsDateString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { HolidayType } from '@hrm/types';

export class CreateHolidayDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsDateString()
  date!: string;

  @IsEnum(HolidayType)
  type!: HolidayType;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
