import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { InputBasis } from '@hrm/types';

export class CreateSalaryGradeDto {
  @IsString()
  name!: string;

  @IsEnum(InputBasis)
  basicDefinition!: InputBasis;

  @IsOptional()
  @IsObject()
  rules?: Record<string, { calcType: string; value: number }>;
}
