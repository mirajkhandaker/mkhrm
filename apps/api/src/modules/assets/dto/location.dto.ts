import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAssetLocationDto {
  @IsString() @Length(1, 40) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAssetLocationDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
