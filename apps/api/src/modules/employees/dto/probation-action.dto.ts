import { IsEnum, IsDateString, IsOptional, IsUUID, IsString, IsInt, Min } from 'class-validator';
import { ProbationStatus } from '@hrm/types';

export class StartProbationDto {
  @IsDateString()
  startDate!: string;

  @IsInt()
  @Min(1)
  probationMonths!: number;

  @IsUUID()
  @IsOptional()
  evaluatorId?: string;
}

export class ProbationActionDto {
  @IsEnum([ProbationStatus.Confirmed, ProbationStatus.Extended, ProbationStatus.Failed])
  action!: ProbationStatus.Confirmed | ProbationStatus.Extended | ProbationStatus.Failed;

  @IsDateString()
  @IsOptional()
  extendedTo?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
