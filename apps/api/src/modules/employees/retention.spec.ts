import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmploymentStatus } from '@hrm/types';
import { RetentionService } from './retention.service';
import { Employee } from '../../database/entities/employees/employee.entity';
import { EmploymentStatusHistory } from '../../database/entities/employees/employment-status-history.entity';
import { Document } from '../../database/entities/employees/document.entity';
import { AuditLog } from '../../database/entities/system/audit-log.entity';
import { SettingsService } from '../settings/settings.service';

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (e: unknown) => e),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    create: jest.fn((d: unknown) => d),
  };
}

async function buildService(retentionDays = 730) {
  const employeeRepo = makeRepo();
  const historyRepo = makeRepo();
  const documentRepo = makeRepo();
  const auditRepo = makeRepo();
  const settingsService = { getValue: jest.fn().mockResolvedValue(retentionDays) };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RetentionService,
      { provide: getRepositoryToken(Employee), useValue: employeeRepo },
      { provide: getRepositoryToken(EmploymentStatusHistory), useValue: historyRepo },
      { provide: getRepositoryToken(Document), useValue: documentRepo },
      { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      { provide: SettingsService, useValue: settingsService },
    ],
  }).compile();

  return {
    svc: module.get(RetentionService),
    employeeRepo, historyRepo, documentRepo, auditRepo, settingsService,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('RetentionService', () => {
  it('anonymizes a terminated employee past the retention window', async () => {
    const { svc, employeeRepo, historyRepo, documentRepo, auditRepo } = await buildService(730);
    const employee = {
      id: 'emp-1',
      employmentStatus: EmploymentStatus.Terminated,
      personalEmail: 'alex@example.com',
      phone: '12345',
      address: '123 Main St',
      dob: '1990-01-01',
      photoUrl: 'http://x/photo.png',
      emergencyContact: { name: 'Sam' },
    };
    employeeRepo.find.mockResolvedValue([employee]);
    historyRepo.findOne.mockResolvedValue({
      employeeId: 'emp-1',
      toStatus: EmploymentStatus.Terminated,
      effectiveDate: daysAgo(800),
    });

    const count = await svc.applyRetention();

    expect(count).toBe(1);
    expect(employee.personalEmail).toBeNull();
    expect(employee.phone).toBeNull();
    expect(employee.address).toBeNull();
    expect(employee.dob).toBeNull();
    expect(employee.photoUrl).toBeNull();
    expect(employee.emergencyContact).toBeNull();
    expect(employeeRepo.save).toHaveBeenCalledWith(employee);
    expect(documentRepo.delete).toHaveBeenCalledWith({ employeeId: 'emp-1' });
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
  });

  it('skips a terminated employee still inside the retention window', async () => {
    const { svc, employeeRepo, historyRepo } = await buildService(730);
    const employee = {
      id: 'emp-2',
      employmentStatus: EmploymentStatus.Terminated,
      personalEmail: 'recent@example.com',
      phone: '999',
      address: 'Somewhere',
    };
    employeeRepo.find.mockResolvedValue([employee]);
    historyRepo.findOne.mockResolvedValue({
      employeeId: 'emp-2',
      toStatus: EmploymentStatus.Terminated,
      effectiveDate: daysAgo(10),
    });

    const count = await svc.applyRetention();

    expect(count).toBe(0);
    expect(employee.personalEmail).toBe('recent@example.com');
    expect(employeeRepo.save).not.toHaveBeenCalled();
  });

  it('skips an employee already anonymized', async () => {
    const { svc, employeeRepo, historyRepo } = await buildService(730);
    const employee = {
      id: 'emp-3',
      employmentStatus: EmploymentStatus.Terminated,
      personalEmail: null,
      phone: null,
      address: null,
    };
    employeeRepo.find.mockResolvedValue([employee]);

    const count = await svc.applyRetention();

    expect(count).toBe(0);
    expect(historyRepo.findOne).not.toHaveBeenCalled();
    expect(employeeRepo.save).not.toHaveBeenCalled();
  });

  it('only queries employees with Terminated status', async () => {
    const { svc, employeeRepo } = await buildService(730);
    await svc.applyRetention();
    expect(employeeRepo.find).toHaveBeenCalledWith({
      where: { employmentStatus: EmploymentStatus.Terminated },
    });
  });
});
