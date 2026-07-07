import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreatePreviousEmploymentDto {
  @IsString()
  companyName!: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  reasonForLeaving?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdatePreviousEmploymentDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  reasonForLeaving?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
