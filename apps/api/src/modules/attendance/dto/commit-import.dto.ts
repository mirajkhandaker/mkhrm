import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class CommitImportDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  rowIds?: string[];
}
