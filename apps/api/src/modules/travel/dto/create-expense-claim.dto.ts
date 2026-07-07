import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentRefDto } from '../../attachments/dto/attachment-ref.dto';

export class CreateExpenseItemDto {
  @IsString()
  @MaxLength(1000)
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  spentOn!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
}

export class CreateExpenseClaimDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsUUID()
  travelRequestId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseItemDto)
  items!: CreateExpenseItemDto[];
}
