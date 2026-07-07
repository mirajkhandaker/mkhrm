import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ExpenseClaimStatus, SalaryStructureStatus } from '@hrm/types';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { LeaveBalance } from '../../database/entities/leave/leave-balance.entity';
import { EmployeeSalaryStructure } from '../../database/entities/compensation/employee-salary-structure.entity';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(LeaveBalance) private leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(EmployeeSalaryStructure) private salaryStructureRepo: Repository<EmployeeSalaryStructure>,
    @InjectRepository(ExpenseClaim) private expenseRepo: Repository<ExpenseClaim>,
  ) {}

  async getAttendanceRows(from: string, to: string) {
    if (!from || !to) throw new BadRequestException('from and to dates are required');
    if (new Date(to) < new Date(from)) throw new BadRequestException('to date must be on or after from date');

    const records = await this.attendanceRepo.find({
      where: { workDate: Between(from, to) },
      relations: ['employee'],
      order: { workDate: 'ASC' },
    });

    return records.map((r) => ({
      'Employee Code': r.employee?.employeeCode ?? '',
      'Employee Name': r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
      'Work Date': r.workDate,
      'Status': r.status,
      'Check In': r.checkInAt ? new Date(r.checkInAt).toISOString() : '',
      'Check Out': r.checkOutAt ? new Date(r.checkOutAt).toISOString() : '',
      'Late Minutes': r.lateMinutes,
      'Early Leave Minutes': r.earlyLeaveMinutes,
      'Worked Minutes': r.workedMinutes,
    }));
  }

  async getLeaveBalanceRows(year: number) {
    const balances = await this.leaveBalanceRepo.find({
      where: { year },
      relations: ['employee', 'leaveType'],
      order: { employee: { employeeCode: 'ASC' } } as never,
    });

    return balances.map((b) => ({
      'Employee Code': b.employee?.employeeCode ?? '',
      'Employee Name': b.employee ? `${b.employee.firstName} ${b.employee.lastName}` : '',
      'Leave Type': b.leaveType?.name ?? '',
      'Entitled': Number(b.entitled),
      'Accrued': Number(b.accrued),
      'Used': Number(b.used),
      'Pending': Number(b.pending),
      'Carried Forward': Number(b.carriedForward),
      'Available': Number(b.available),
    }));
  }

  async getSalarySummaryRows() {
    const structures = await this.salaryStructureRepo.find({
      where: { status: SalaryStructureStatus.Active },
      relations: ['employee'],
      order: { employee: { employeeCode: 'ASC' } } as never,
    });

    return structures.map((s) => ({
      'Employee Code': s.employee?.employeeCode ?? '',
      'Employee Name': s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : '',
      'Input Basis': s.inputBasis,
      'Basic Amount': Number(s.basicAmount),
      'Gross Amount': Number(s.grossAmount),
      'CTC Amount': Number(s.ctcAmount),
      'Currency': s.currency,
      'Effective From': s.effectiveFrom,
    }));
  }

  async getExpenseRows(status?: string) {
    const claims = await this.expenseRepo.find({
      where: status ? { status: status as ExpenseClaimStatus } : {},
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });

    return claims.map((c) => ({
      'Employee Code': c.employee?.employeeCode ?? '',
      'Employee Name': c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : '',
      'Title': c.title,
      'Total Amount': Number(c.totalAmount),
      'Currency': c.currency,
      'Status': c.status,
      'Reimbursed At': c.reimbursedAt ? new Date(c.reimbursedAt).toISOString() : '',
      'Reimbursement Ref': c.reimbursementRef ?? '',
    }));
  }
}
