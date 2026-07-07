import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmploymentStatus } from '@hrm/types';
import { Employee } from '../../database/entities/employees/employee.entity';
import { EmploymentStatusHistory } from '../../database/entities/employees/employment-status-history.entity';
import { Document } from '../../database/entities/employees/document.entity';
import { AuditLog } from '../../database/entities/system/audit-log.entity';
import { SettingsService } from '../settings/settings.service';

const DEFAULT_RETENTION_DAYS = 730;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmploymentStatusHistory)
    private readonly historyRepo: Repository<EmploymentStatusHistory>,
    @InjectRepository(Document) private readonly documentRepo: Repository<Document>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly settingsService: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run(): Promise<void> {
    const count = await this.applyRetention();
    if (count > 0) this.logger.log(`Data retention: anonymized ${count} terminated employee record(s).`);
  }

  /** Anonymizes PII for employees terminated longer than the configured retention window. */
  async applyRetention(): Promise<number> {
    const retentionDays = await this.settingsService.getValue(
      'terminated_data_retention_days',
      DEFAULT_RETENTION_DAYS,
    );
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const terminated = await this.employeeRepo.find({
      where: { employmentStatus: EmploymentStatus.Terminated },
    });

    let anonymizedCount = 0;
    for (const employee of terminated) {
      if (employee.personalEmail === null && employee.phone === null && employee.address === null) {
        continue; // already anonymized
      }

      const lastTerminatedHistory = await this.historyRepo.findOne({
        where: { employeeId: employee.id, toStatus: EmploymentStatus.Terminated },
        order: { effectiveDate: 'DESC' },
      });
      if (!lastTerminatedHistory) continue;
      if (new Date(lastTerminatedHistory.effectiveDate) > cutoff) continue;

      employee.dob = null;
      employee.personalEmail = null;
      employee.phone = null;
      employee.photoUrl = null;
      employee.address = null;
      employee.emergencyContact = null;
      await this.employeeRepo.save(employee);
      await this.documentRepo.delete({ employeeId: employee.id });

      await this.auditRepo.save(
        this.auditRepo.create({
          actorId: null,
          action: 'RETENTION_ANONYMIZE',
          entityType: 'employees',
          entityId: employee.id,
          diff: { retentionDays, terminatedOn: lastTerminatedHistory.effectiveDate },
          ip: null,
        }),
      );
      anonymizedCount++;
    }

    return anonymizedCount;
  }
}
