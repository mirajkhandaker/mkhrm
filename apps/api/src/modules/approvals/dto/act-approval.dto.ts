import { IsEnum, IsOptional, IsString, IsNumber, Min, MaxLength } from 'class-validator';
import { ApprovalAction } from '@hrm/types';

export class ActApprovalDto {
  @IsEnum(ApprovalAction)
  action!: ApprovalAction;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAmount?: number;
}
