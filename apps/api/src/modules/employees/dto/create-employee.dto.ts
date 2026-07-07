import {
  IsString,
  IsOptional,
  IsUUID,
  IsEmail,
  IsEnum,
  IsDateString,
  MinLength,
} from 'class-validator';
import { EmploymentType, Gender } from '@hrm/types';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsDateString()
  joinDate!: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  designationId?: string;

  @IsUUID()
  @IsOptional()
  lineManagerId?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString()
  @IsOptional()
  dob?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  personalEmail?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
