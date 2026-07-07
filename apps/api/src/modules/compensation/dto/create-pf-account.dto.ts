import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { PfBase, PfStatus } from '@hrm/types';

export class CreatePfAccountDto {
  @IsOptional()
  @IsString()
  pfNumber?: string;

  @IsString()
  enrolledOn!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  employeeContribPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  employerContribPercent?: number;

  @IsOptional()
  @IsEnum(PfBase)
  pfBase?: PfBase;

  @IsOptional()
  @IsEnum(PfStatus)
  status?: PfStatus;
}

export class UpdatePfAccountDto {
  @IsOptional()
  @IsString()
  pfNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  employeeContribPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  employerContribPercent?: number;

  @IsOptional()
  @IsEnum(PfBase)
  pfBase?: PfBase;

  @IsOptional()
  @IsEnum(PfStatus)
  status?: PfStatus;
}
