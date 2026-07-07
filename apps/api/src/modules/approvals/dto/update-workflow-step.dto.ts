import { IsEnum, IsString, IsBoolean, IsOptional, IsInt, IsNumber, Min } from 'class-validator';
import { ApproverType } from '@hrm/types';

export class UpdateWorkflowStepDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  stepOrder?: number;

  @IsOptional()
  @IsEnum(ApproverType)
  approverType?: ApproverType;

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
