import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesService } from './employees.service';
import { DepartmentsService } from './departments.service';
import { DesignationsService } from './designations.service';
import { EmployeesController } from './employees.controller';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Designation } from '../../database/entities/employees/designation.entity';
import { JobChange } from '../../database/entities/employees/job-change.entity';
import { ProbationRecord } from '../../database/entities/employees/probation-record.entity';
import { EmploymentStatusHistory } from '../../database/entities/employees/employment-status-history.entity';
import { Document } from '../../database/entities/employees/document.entity';
import { Education } from '../../database/entities/employees/education.entity';
import { PreviousEmployment } from '../../database/entities/employees/previous-employment.entity';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { RetentionService } from './retention.service';
import { AuditLog } from '../../database/entities/system/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Department,
      Designation,
      JobChange,
      ProbationRecord,
      EmploymentStatusHistory,
      Document,
      Education,
      PreviousEmployment,
      AuditLog,
    ]),
    AuthModule,
    SettingsModule,
  ],
  providers: [EmployeesService, DepartmentsService, DesignationsService, RetentionService],
  controllers: [EmployeesController],
  exports: [EmployeesService, TypeOrmModule],
})
export class EmployeesModule {}
