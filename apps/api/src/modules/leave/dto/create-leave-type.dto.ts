import {
  IsString,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { AccrualMethod } from '@hrm/types';

export class CreateLeaveTypeDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9_]+$/, { message: 'code must be uppercase letters, digits, or underscores' })
  code!: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDocument?: boolean;

  @IsOptional()
  @IsEnum(AccrualMethod)
  accrualMethod?: AccrualMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDaysPerYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCarryForward?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g. #FF0000)' })
  color?: string;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDocument?: boolean;

  @IsOptional()
  @IsEnum(AccrualMethod)
  accrualMethod?: AccrualMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDaysPerYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCarryForward?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g. #FF0000)' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
