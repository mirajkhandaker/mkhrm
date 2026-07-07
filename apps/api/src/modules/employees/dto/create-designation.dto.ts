import { IsString, IsOptional, IsInt, Min, MinLength } from 'class-validator';

export class CreateDesignationDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  level?: number;
}
