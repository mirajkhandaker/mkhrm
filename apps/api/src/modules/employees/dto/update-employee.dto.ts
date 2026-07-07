import {
  IsString,
  IsOptional,
  IsUUID,
  IsEmail,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Gender } from '@hrm/types';

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

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

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  designationId?: string;

  @IsUUID()
  @IsOptional()
  lineManagerId?: string;
}
