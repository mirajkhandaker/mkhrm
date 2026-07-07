import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { AssetHolderType } from '@hrm/types';

// A holder is exactly one of employee / department / location. The service
// resolves this into the corresponding current_* column on asset_units.
export class AssignUnitDto {
  @IsEnum(AssetHolderType) type!: AssetHolderType;
  @IsUUID() id!: string;
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

export class TransferUnitDto {
  @IsEnum(AssetHolderType) type!: AssetHolderType;
  @IsUUID() id!: string;
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

export class ReturnUnitDto {
  @IsUUID() toLocationId!: string;
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}

export class RetireUnitDto {
  @IsOptional() @IsString() @Length(0, 500) reason?: string;
}

export class UpdateUnitDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @Length(0, 200) serialNo?: string;
  @IsOptional() @IsUUID() conditionId?: string;
  @IsOptional() @IsString() notes?: string;
}
