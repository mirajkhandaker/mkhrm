import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseItemDto {
  @IsUUID() categoryId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitCost!: number;
  @IsOptional() @IsInt() @Min(0) warrantyMonths?: number;
  @IsUUID() locationId!: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateAssetPurchaseDto {
  @IsString() @Length(1, 200) vendor!: string;
  @IsOptional() @IsString() @Length(0, 80) invoiceNo?: string;
  @IsDateString() invoiceDate!: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsUUID() linkedRequisitionId?: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}
