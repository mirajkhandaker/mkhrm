import {
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
  IsString,
} from 'class-validator';
import { JobChangeType } from '@hrm/types';

export class JobChangeDto {
  @IsEnum(JobChangeType)
  type!: JobChangeType;

  @IsDateString()
  effectiveDate!: string;

  @IsUUID()
  @IsOptional()
  toDepartmentId?: string;

  @IsUUID()
  @IsOptional()
  toDesignationId?: string;

  @IsUUID()
  @IsOptional()
  toManagerId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
