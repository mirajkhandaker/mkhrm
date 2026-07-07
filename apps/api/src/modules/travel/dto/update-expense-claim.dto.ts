import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateExpenseItemDto } from './create-expense-claim.dto';

export class UpdateExpenseItemDto extends CreateExpenseItemDto {
  // Present when this line is an existing item being kept/amended; absent when it's a
  // newly added item. Any existing item whose id is missing from the submitted array is
  // treated as removed.
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateExpenseClaimDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateExpenseItemDto)
  items!: UpdateExpenseItemDto[];
}
