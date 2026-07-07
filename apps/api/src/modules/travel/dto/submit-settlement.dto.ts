import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TravelCostCategory } from '@hrm/types';
import { AttachmentRefDto } from '../../attachments/dto/attachment-ref.dto';

export class SubmitSettlementItemDto {
  // Present when settling an existing planned leg; absent for an unplanned cost
  // discovered only after travel (description/category/dates then become required).
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(TravelCostCategory)
  category?: TravelCostCategory;

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

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsNumber()
  @Min(0)
  actualCost!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
}

export class SubmitSettlementDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitSettlementItemDto)
  items!: SubmitSettlementItemDto[];
}
