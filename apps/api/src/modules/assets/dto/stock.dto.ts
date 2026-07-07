import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { AssetHolderType } from '@hrm/types';

export class StockAdjustDto {
  @IsUUID() categoryId!: string;
  @IsUUID() locationId!: string;
  @IsInt() delta!: number; // positive to add, negative to subtract
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

export class IssueConsumableDto {
  @IsUUID() categoryId!: string;
  @IsUUID() locationId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsEnum(AssetHolderType) toHolderType!: AssetHolderType;
  @IsUUID() toHolderId!: string;
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

export class SetMinQuantityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  minQuantity?: number;
}
