import { IsArray, IsUUID } from 'class-validator';

export class ReorderStepsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  stepIds!: string[];
}
