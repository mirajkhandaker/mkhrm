import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class UpdateDepartmentDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  code?: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsUUID()
  @IsOptional()
  headEmployeeId?: string;
}
