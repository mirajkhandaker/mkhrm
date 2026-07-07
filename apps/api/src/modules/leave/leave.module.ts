import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveType } from '../../database/entities/leave/leave-type.entity';
import { LeavePolicy } from '../../database/entities/leave/leave-policy.entity';
import { LeaveBalance } from '../../database/entities/leave/leave-balance.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';
import { LeaveLedger } from '../../database/entities/leave/leave-ledger.entity';
import { Holiday } from '../../database/entities/attendance/holiday.entity';
import { Setting } from '../../database/entities/system/setting.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { AuthModule } from '../auth/auth.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { LeaveCalculatorService } from './leave-calculator.service';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveType,
      LeavePolicy,
      LeaveBalance,
      LeaveApplication,
      LeaveLedger,
      Holiday,
      Setting,
      Employee,
    ]),
    AuthModule,
    ApprovalsModule,
  ],
  providers: [LeaveCalculatorService, LeaveService],
  controllers: [LeaveController],
  exports: [LeaveService, TypeOrmModule],
})
export class LeaveModule {}
