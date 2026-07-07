import { IsString, IsInt, Min, MaxLength } from 'class-validator';

// Shape returned by POST /attachments/stage and re-submitted by the owning item's
// create/update DTO so the service can persist the real Attachment row once the
// owning item id is known.
export class AttachmentRefDto {
  @IsString()
  @MaxLength(500)
  fileUrl!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @IsInt()
  @Min(1)
  fileSizeBytes!: number;
}
