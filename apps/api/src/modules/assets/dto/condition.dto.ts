import { IsBoolean, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateAssetConditionDto {
  @IsString() @Length(1, 40) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAssetConditionDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
