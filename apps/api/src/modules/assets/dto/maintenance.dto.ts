import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { AssetMaintenanceOutcome } from '@hrm/types';

export class StartMaintenanceDto {
  @IsUUID() unitId!: string;
  @IsString() @Length(1, 500) description!: string;
  @IsOptional() @IsString() @Length(0, 200) vendor?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cost?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
}

export class EndMaintenanceDto {
  @IsEnum(AssetMaintenanceOutcome) outcome!: AssetMaintenanceOutcome;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cost?: number;
  @IsOptional() @IsString() @Length(0, 500) note?: string;
}
