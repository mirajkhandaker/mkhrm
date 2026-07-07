import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}
