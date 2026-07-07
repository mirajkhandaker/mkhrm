import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { AttachmentOwnerType, Permission } from '@hrm/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AttachmentsService } from './attachments.service';

const CAN_VIEW_ALL_PERMISSIONS = [
  Permission.TravelApprove,
  Permission.TravelSettle,
  Permission.ExpenseApprove,
  Permission.ExpenseReimburse,
];

@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly svc: AttachmentsService) {}

  @Post('stage')
  @UseInterceptors(FileInterceptor('file'))
  stage(@UploadedFile() file: Express.Multer.File) {
    return this.svc.stageFile(file);
  }

  @Get()
  list(@Query('ownerType') ownerType: string, @Query('ownerId', ParseUUIDPipe) ownerId: string) {
    if (!Object.values(AttachmentOwnerType).includes(ownerType as AttachmentOwnerType)) {
      throw new BadRequestException('Invalid ownerType');
    }
    return this.svc.listForOwner(ownerType as AttachmentOwnerType, ownerId);
  }

  @Get(':id/file')
  async getFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const attachment = await this.svc.getById(id);
    const canViewAll = CAN_VIEW_ALL_PERMISSIONS.some((p) => user.permissions.includes(p));
    await this.svc.assertAccess(attachment, user.sub, canViewAll);

    const filePath = join(process.cwd(), attachment.fileUrl);
    if (!existsSync(filePath)) throw new BadRequestException('File not found on disk');
    const safeFileName = attachment.fileName.replace(/[^\x20-\x7E]/g, '').replace(/"/g, "'");
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    createReadStream(filePath).pipe(res);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.deleteOwned(id, user.sub);
  }
}
