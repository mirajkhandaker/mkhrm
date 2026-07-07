import {
  IsEnum,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalEntityType, ApproverType } from '@hrm/types';

export class CreateWorkflowStepDto {
  @IsInt()
  @Min(1)
  stepOrder!: number;

  @IsEnum(ApproverType)
  approverType!: ApproverType;

  @IsOptional()
  @IsString()
  approverRef?: string | null;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaHours?: number | null;

  @IsOptional()
  @IsNumber()
  minMetricValue?: number | null;

  @IsOptional()
  @IsNumber()
  maxMetricValue?: number | null;
}

export class CreateWorkflowDto {
  @IsString()
  name!: string;

  @IsEnum(ApprovalEntityType)
  entityType!: ApprovalEntityType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps?: CreateWorkflowStepDto[];
}
