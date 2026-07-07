import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../../database/entities/employees/employee.entity';
import { ProbationRecord } from '../../database/entities/employees/probation-record.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { LeaveBalance } from '../../database/entities/leave/leave-balance.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';
import { Requisition } from '../../database/entities/requisitions/requisition.entity';
import { TravelRequest } from '../../database/entities/travel/travel-request.entity';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';
import { AuthModule } from '../auth/auth.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      ProbationRecord,
      AttendanceRecord,
      LeaveBalance,
      LeaveApplication,
      Requisition,
      TravelRequest,
      ExpenseClaim,
    ]),
    AuthModule,
    ApprovalsModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
