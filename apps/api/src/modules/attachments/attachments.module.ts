import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from '../../database/entities/system/attachment.entity';
import { TravelRequestItem } from '../../database/entities/travel/travel-request-item.entity';
import { ExpenseItem } from '../../database/entities/travel/expense-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { AssetUnit } from '../../database/entities/assets/asset-unit.entity';
import { AssetPurchase } from '../../database/entities/assets/asset-purchase.entity';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsService } from './attachments.service';
import { AttachmentsController } from './attachments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment, TravelRequestItem, ExpenseItem, Employee, AssetUnit, AssetPurchase]),
    AuthModule,
  ],
  providers: [AttachmentsService],
  controllers: [AttachmentsController],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
