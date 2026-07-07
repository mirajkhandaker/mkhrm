import { IsString, IsOptional, IsUUID, IsInt, Min, MaxLength } from 'class-validator';

export class CreateRosterDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsInt()
  @Min(1)
  cycleDays!: number;
}
