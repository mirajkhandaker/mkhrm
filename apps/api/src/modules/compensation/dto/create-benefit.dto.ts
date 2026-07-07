import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { BenefitType, BenefitValueType } from '@hrm/types';

export class CreateBenefitDto {
  @IsEnum(BenefitType)
  type!: BenefitType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(BenefitValueType)
  valueType!: BenefitValueType;

  @IsString()
  value!: string;

  @IsString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateBenefitDto {
  @IsOptional()
  @IsEnum(BenefitType)
  type?: BenefitType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BenefitValueType)
  valueType?: BenefitValueType;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
