import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequisitionType, RequisitionPriority } from '@hrm/types';

export class CreateRequisitionItemDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateRequisitionDto {
  @IsEnum(RequisitionType)
  type!: RequisitionType;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(RequisitionPriority)
  priority?: RequisitionPriority;

  @IsOptional()
  @IsDateString()
  neededBy?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRequisitionItemDto)
  items!: CreateRequisitionItemDto[];
}
