import { IsUUID, IsNumber, IsString, IsInt, MaxLength } from 'class-validator';

export class AdjustBalanceDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  leaveTypeId!: string;

  @IsInt()
  year!: number;

  @IsNumber()
  change!: number;

  @IsString()
  @MaxLength(500)
  note!: string;
}
