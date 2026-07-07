import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { AttachmentOwnerType } from '@hrm/types';
import { User } from '../auth/user.entity';

@Entity({ name: 'attachments' })
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: AttachmentOwnerType, name: 'owner_type' })
  ownerType!: AttachmentOwnerType;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @Column({ type: 'varchar', name: 'file_url' })
  fileUrl!: string;

  @Column({ type: 'varchar', name: 'file_name' })
  fileName!: string;

  @Column({ type: 'varchar', name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'int', name: 'file_size_bytes' })
  fileSizeBytes!: number;

  @Column({ type: 'uuid', name: 'uploaded_by' })
  uploadedBy!: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'uploaded_by' })
  uploader!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
