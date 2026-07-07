import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from '../../database/entities/attendance/shift.entity';
import { Schedule } from '../../database/entities/attendance/schedule.entity';
import { Roster } from '../../database/entities/attendance/roster.entity';
import { RosterAssignment } from '../../database/entities/attendance/roster-assignment.entity';
import { Holiday } from '../../database/entities/attendance/holiday.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { AttendanceRegularization } from '../../database/entities/attendance/attendance-regularization.entity';
import { ImportBatch } from '../../database/entities/attendance/import-batch.entity';
import { ImportRow } from '../../database/entities/attendance/import-row.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Setting } from '../../database/entities/system/setting.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';
import { AuthModule } from '../auth/auth.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { SettingsModule } from '../settings/settings.module';
import { AttendanceResolverService } from './attendance-resolver.service';
import { AttendanceService } from './attendance.service';
import { ImportService } from './import.service';
import { AttendanceController } from './attendance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shift,
      Schedule,
      Roster,
      RosterAssignment,
      Holiday,
      AttendanceRecord,
      AttendanceRegularization,
      ImportBatch,
      ImportRow,
      Employee,
      Department,
      Setting,
      LeaveApplication,
      ApprovalActionRecord,
    ]),
    AuthModule,
    ApprovalsModule,
    SettingsModule,
  ],
  providers: [AttendanceResolverService, AttendanceService, ImportService],
  controllers: [AttendanceController],
  exports: [AttendanceResolverService, AttendanceService, TypeOrmModule],
})
export class AttendanceModule {}
