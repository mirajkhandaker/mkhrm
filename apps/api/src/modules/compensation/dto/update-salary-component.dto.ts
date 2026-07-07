import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';
import { SalaryComponentType, SalaryCalcType } from '@hrm/types';

export class UpdateSalaryComponentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(SalaryComponentType)
  type?: SalaryComponentType;

  @IsOptional()
  @IsEnum(SalaryCalcType)
  calcType?: SalaryCalcType;

  @IsOptional()
  @IsNumber()
  defaultValue?: number;

  @IsOptional()
  @IsBoolean()
  isPfApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
