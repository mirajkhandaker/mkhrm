import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { LeaveBalance } from '../../database/entities/leave/leave-balance.entity';
import { EmployeeSalaryStructure } from '../../database/entities/compensation/employee-salary-structure.entity';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';
import { AuthModule } from '../auth/auth.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord, LeaveBalance, EmployeeSalaryStructure, ExpenseClaim]),
    AuthModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
