import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AttachmentOwnerType } from '@hrm/types';
import { Attachment } from '../../database/entities/system/attachment.entity';
import { TravelRequestItem } from '../../database/entities/travel/travel-request-item.entity';
import { ExpenseItem } from '../../database/entities/travel/expense-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { AttachmentRefDto } from './dto/attachment-ref.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'attachments');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment) private attachmentRepo: Repository<Attachment>,
    @InjectRepository(TravelRequestItem) private travelItemRepo: Repository<TravelRequestItem>,
    @InjectRepository(ExpenseItem) private expenseItemRepo: Repository<ExpenseItem>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
  ) {}

  // ── Staging (upload before the owning item exists) ──────────────────────────

  stageFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File must be a JPEG, PNG, WEBP or PDF file');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File must be smaller than 5MB');
    }

    mkdirSync(UPLOAD_DIR, { recursive: true });
    const storedName = `${randomUUID()}-${file.originalname}`;
    writeFileSync(join(UPLOAD_DIR, storedName), file.buffer);

    return {
      fileUrl: join('uploads', 'attachments', storedName).replace(/\\/g, '/'),
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    };
  }

  // ── Persisting (called by TravelService/ExpenseService inside their own transaction) ──

  async createAttachments(
    em: EntityManager,
    ownerType: AttachmentOwnerType,
    ownerId: string,
    uploadedBy: string,
    staged: AttachmentRefDto[] | undefined,
  ): Promise<void> {
    if (!staged?.length) return;
    await em.save(
      Attachment,
      staged.map((s) =>
        em.create(Attachment, {
          ownerType,
          ownerId,
          fileUrl: s.fileUrl,
          fileName: s.fileName,
          mimeType: s.mimeType,
          fileSizeBytes: s.fileSizeBytes,
          uploadedBy,
        }),
      ),
    );
  }

  // ── Reading ──────────────────────────────────────────────────────────────────

  listForOwner(ownerType: AttachmentOwnerType, ownerId: string) {
    return this.attachmentRepo.find({ where: { ownerType, ownerId }, order: { createdAt: 'ASC' } });
  }

  async getById(id: string) {
    const attachment = await this.attachmentRepo.findOne({ where: { id } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async assertAccess(attachment: Attachment, userId: string, canViewAll: boolean): Promise<void> {
    if (canViewAll) return;
    const ownerEmployeeId = await this.resolveOwnerEmployeeId(attachment);
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee || !ownerEmployeeId || ownerEmployeeId !== employee.id) {
      throw new ForbiddenException('You do not have access to this file');
    }
  }

  async deleteOwned(id: string, userId: string): Promise<void> {
    const attachment = await this.getById(id);
    const ownerEmployeeId = await this.resolveOwnerEmployeeId(attachment);
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee || !ownerEmployeeId || ownerEmployeeId !== employee.id) {
      throw new ForbiddenException('You can only remove your own attachments');
    }
    await this.attachmentRepo.delete({ id });
  }

  private async resolveOwnerEmployeeId(attachment: Attachment): Promise<string | null> {
    if (attachment.ownerType === AttachmentOwnerType.TravelRequestItem) {
      const item = await this.travelItemRepo.findOne({
        where: { id: attachment.ownerId },
        relations: ['travelRequest'],
      });
      return item?.travelRequest?.employeeId ?? null;
    }
    const item = await this.expenseItemRepo.findOne({
      where: { id: attachment.ownerId },
      relations: ['expenseClaim'],
    });
    return item?.expenseClaim?.employeeId ?? null;
  }
}
