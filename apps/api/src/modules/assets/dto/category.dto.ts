import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { AssetTrackingMode, DepreciationMethod } from '@hrm/types';

export class CreateAssetCategoryDto {
  @IsString()
  @Length(1, 40)
  code!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsEnum(AssetTrackingMode)
  trackingMode!: AssetTrackingMode;

  @IsOptional()
  @IsEnum(DepreciationMethod)
  depreciationMethod?: DepreciationMethod;

  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultWarrantyMonths?: number;

  @IsOptional()
  @IsBoolean()
  requiresAssetTag?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAssetCategoryDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsEnum(DepreciationMethod) depreciationMethod?: DepreciationMethod;
  @IsOptional() @IsInt() @Min(1) usefulLifeMonths?: number;
  @IsOptional() @IsInt() @Min(0) defaultWarrantyMonths?: number;
  @IsOptional() @IsBoolean() requiresAssetTag?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
