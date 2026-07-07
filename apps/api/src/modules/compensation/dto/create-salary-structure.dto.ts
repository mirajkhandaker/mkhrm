import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InputBasis, SalaryRevisionReason } from '@hrm/types';

export class SalaryLineInputDto {
  @IsUUID()
  componentId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputValue?: number;
}

export class CreateSalaryStructureDto {
  @IsString()
  effectiveFrom!: string;

  @IsEnum(InputBasis)
  inputBasis!: InputBasis;

  @IsNumber()
  @Min(0)
  inputAmount!: number;

  @IsEnum(SalaryRevisionReason)
  reason!: SalaryRevisionReason;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryLineInputDto)
  lines!: SalaryLineInputDto[];
}
