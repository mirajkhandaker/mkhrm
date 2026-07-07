import { IsArray, IsDateString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RosterAssignmentEntryDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  shiftId!: string;

  @IsDateString()
  workDate!: string;
}

export class AssignRosterDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RosterAssignmentEntryDto)
  assignments!: RosterAssignmentEntryDto[];
}
