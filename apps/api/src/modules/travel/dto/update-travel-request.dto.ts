import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsNumber,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTravelRequestItemDto } from './create-travel-request.dto';

export class UpdateTravelRequestItemDto extends CreateTravelRequestItemDto {
  // Present when this line is an existing item being kept/amended; absent when it's a
  // newly added leg. Any pre-trip item whose id is missing from the submitted array is
  // treated as removed.
  @IsOptional()
  @IsUUID()
  id?: string;
}

export class UpdateTravelRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  purpose?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceRequested?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateTravelRequestItemDto)
  items!: UpdateTravelRequestItemDto[];
}
