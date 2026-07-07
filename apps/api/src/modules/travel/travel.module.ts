import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelRequest } from '../../database/entities/travel/travel-request.entity';
import { TravelRequestItem } from '../../database/entities/travel/travel-request-item.entity';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';
import { ExpenseItem } from '../../database/entities/travel/expense-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { AuthModule } from '../auth/auth.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ChangeLogModule } from '../change-log/change-log.module';
import { TravelService } from './travel.service';
import { TravelController } from './travel.controller';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TravelRequest, TravelRequestItem, ExpenseClaim, ExpenseItem, Employee]),
    AuthModule,
    ApprovalsModule,
    AttachmentsModule,
    ChangeLogModule,
  ],
  providers: [TravelService, ExpenseService],
  controllers: [TravelController, ExpenseController],
  exports: [TravelService, ExpenseService, TypeOrmModule],
})
export class TravelModule {}
