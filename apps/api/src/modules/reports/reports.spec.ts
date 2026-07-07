import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { AttendanceStatus, ExpenseClaimStatus, InputBasis, SalaryRevisionReason, SalaryStructureStatus } from '@hrm/types';
import { ReportsService } from './reports.service';
import { buildExportBuffer } from '../../common/utils/export.util';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { LeaveBalance } from '../../database/entities/leave/leave-balance.entity';
import { EmployeeSalaryStructure } from '../../database/entities/compensation/employee-salary-structure.entity';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';

function makeRepo() {
  return { find: jest.fn().mockResolvedValue([]) };
}

async function buildService() {
  const attendanceRepo = makeRepo();
  const leaveBalanceRepo = makeRepo();
  const salaryStructureRepo = makeRepo();
  const expenseRepo = makeRepo();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReportsService,
      { provide: getRepositoryToken(AttendanceRecord), useValue: attendanceRepo },
      { provide: getRepositoryToken(LeaveBalance), useValue: leaveBalanceRepo },
      { provide: getRepositoryToken(EmployeeSalaryStructure), useValue: salaryStructureRepo },
      { provide: getRepositoryToken(ExpenseClaim), useValue: expenseRepo },
    ],
  }).compile();

  return {
    svc: module.get(ReportsService),
    attendanceRepo, leaveBalanceRepo, salaryStructureRepo, expenseRepo,
  };
}

describe('ReportsService', () => {
  it('getAttendanceRows rejects an inverted date range', async () => {
    const { svc } = await buildService();
    await expect(svc.getAttendanceRows('2026-07-10', '2026-07-01')).rejects.toThrow(BadRequestException);
  });

  it('getAttendanceRows shapes rows from attendance records', async () => {
    const { svc, attendanceRepo } = await buildService();
    attendanceRepo.find.mockResolvedValue([{
      employee: { employeeCode: 'EMP-001', firstName: 'Alex', lastName: 'Chen' },
      workDate: '2026-07-01',
      status: AttendanceStatus.Late,
      checkInAt: new Date('2026-07-01T09:20:00Z'),
      checkOutAt: new Date('2026-07-01T17:00:00Z'),
      lateMinutes: 5,
      earlyLeaveMinutes: 0,
      workedMinutes: 460,
    }]);

    const rows = await svc.getAttendanceRows('2026-07-01', '2026-07-31');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      'Employee Code': 'EMP-001',
      'Employee Name': 'Alex Chen',
      'Status': AttendanceStatus.Late,
      'Late Minutes': 5,
    });
  });

  it('getLeaveBalanceRows shapes rows from leave balances', async () => {
    const { svc, leaveBalanceRepo } = await buildService();
    leaveBalanceRepo.find.mockResolvedValue([{
      employee: { employeeCode: 'EMP-001', firstName: 'Alex', lastName: 'Chen' },
      leaveType: { name: 'Casual Leave' },
      entitled: '10.0', accrued: '10.0', used: '2.0', pending: '1.0', carriedForward: '0.0', available: '7.0',
    }]);

    const rows = await svc.getLeaveBalanceRows(2026);
    expect(rows[0]).toMatchObject({ 'Leave Type': 'Casual Leave', 'Available': 7 });
  });

  it('getSalarySummaryRows only reflects active structures', async () => {
    const { svc, salaryStructureRepo } = await buildService();
    salaryStructureRepo.find.mockResolvedValue([{
      employee: { employeeCode: 'EMP-001', firstName: 'Alex', lastName: 'Chen' },
      inputBasis: InputBasis.Gross,
      basicAmount: '30000.00', grossAmount: '50000.00', ctcAmount: '55000.00',
      currency: 'BDT', effectiveFrom: '2026-01-01',
      reason: SalaryRevisionReason.Initial, status: SalaryStructureStatus.Active,
    }]);

    const rows = await svc.getSalarySummaryRows();
    expect(salaryStructureRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: SalaryStructureStatus.Active },
    }));
    expect(rows[0]).toMatchObject({ 'Gross Amount': 50000, 'CTC Amount': 55000 });
  });

  it('getExpenseRows filters by status when provided', async () => {
    const { svc, expenseRepo } = await buildService();
    expenseRepo.find.mockResolvedValue([{
      employee: { employeeCode: 'EMP-001', firstName: 'Alex', lastName: 'Chen' },
      title: 'Client visit', totalAmount: '190.00', currency: 'BDT',
      status: ExpenseClaimStatus.Reimbursed, reimbursedAt: new Date('2026-07-02T00:00:00Z'), reimbursementRef: 'TXN-1',
    }]);

    const rows = await svc.getExpenseRows(ExpenseClaimStatus.Reimbursed);
    expect(expenseRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: ExpenseClaimStatus.Reimbursed },
    }));
    expect(rows[0]).toMatchObject({ 'Reimbursement Ref': 'TXN-1' });
  });
});

describe('buildExportBuffer', () => {
  const rows = [{ Name: 'Alex Chen', Amount: 150.5 }, { Name: 'Morgan Reyes', Amount: 40 }];

  it('produces a valid xlsx buffer that round-trips the data', () => {
    const buffer = buildExportBuffer(rows, 'xlsx', 'Report');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const parsed = XLSX.utils.sheet_to_json(sheet);
    expect(parsed).toEqual(rows);
  });

  it('produces a valid csv buffer', () => {
    const buffer = buildExportBuffer(rows, 'csv');
    const csv = buffer.toString('utf-8');
    expect(csv).toContain('Name,Amount');
    expect(csv).toContain('Alex Chen,150.5');
  });
});
