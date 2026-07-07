import { IsEnum, IsString, IsOptional, IsInt } from 'class-validator';
import { EducationDegree } from '@hrm/types';

export class CreateEducationDto {
  @IsEnum(EducationDegree)
  degree!: EducationDegree;

  @IsString()
  institution!: string;

  @IsString()
  @IsOptional()
  fieldOfStudy?: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsInt()
  @IsOptional()
  startYear?: number;

  @IsInt()
  @IsOptional()
  endYear?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateEducationDto {
  @IsEnum(EducationDegree)
  @IsOptional()
  degree?: EducationDegree;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  fieldOfStudy?: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsInt()
  @IsOptional()
  startYear?: number;

  @IsInt()
  @IsOptional()
  endYear?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
