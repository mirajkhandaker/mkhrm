import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Requisition } from '../../database/entities/requisitions/requisition.entity';
import { RequisitionItem } from '../../database/entities/requisitions/requisition-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { AuthModule } from '../auth/auth.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { RequisitionsService } from './requisitions.service';
import { RequisitionsController } from './requisitions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Requisition, RequisitionItem, Employee]),
    AuthModule,
    ApprovalsModule,
  ],
  providers: [RequisitionsService],
  controllers: [RequisitionsController],
  exports: [RequisitionsService, TypeOrmModule],
})
export class RequisitionsModule {}
