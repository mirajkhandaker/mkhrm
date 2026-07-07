import { IsArray, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class ColumnMappingDto {
  @IsOptional()
  @IsString()
  employeeCodeColumn?: string;

  @IsOptional()
  @IsString()
  deviceUserIdColumn?: string;

  @IsString()
  dateColumn!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  timeColumns!: string[];

  @IsOptional()
  @IsString()
  dateFormat?: string;
}
