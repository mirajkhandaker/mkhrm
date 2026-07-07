import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TravelTransportMode, TravelCostCategory, TravelRequestTiming } from '@hrm/types';
import { AttachmentRefDto } from '../../attachments/dto/attachment-ref.dto';

export class CreateTravelRequestItemDto {
  @IsString()
  @MaxLength(1000)
  description!: string;

  @IsEnum(TravelCostCategory)
  category!: TravelCostCategory;

  @IsOptional()
  @IsEnum(TravelTransportMode)
  transportMode?: TravelTransportMode;

  // Only meaningful when category = Travel (Transport).
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  toLocation?: string;

  @IsOptional()
  @IsBoolean()
  isRoundTrip?: boolean;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsNumber()
  @Min(0)
  estimatedCost!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
}

export class CreateTravelRequestDto {
  @IsString()
  @MaxLength(255)
  purpose!: string;

  // Defaults to PreTrip in the service if omitted. When PostTrip, the service ignores
  // advanceRequested and forces it to 0 — a post-trip request is reimbursed directly,
  // never advanced.
  @IsOptional()
  @IsEnum(TravelRequestTiming)
  timing?: TravelRequestTiming;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceRequested?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTravelRequestItemDto)
  items!: CreateTravelRequestItemDto[];
}
