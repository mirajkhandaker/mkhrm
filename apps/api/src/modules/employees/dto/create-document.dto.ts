import { IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '@hrm/types';

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  label?: string;
}
