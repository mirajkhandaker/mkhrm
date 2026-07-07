import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttendanceStatus, ExpenseClaimStatus, LeaveApplicationStatus, ProbationStatus, RequisitionStatus, TravelRequestStatus, EmployeeStatus } from '@hrm/types';
import { Employee } from '../../database/entities/employees/employee.entity';
import { ProbationRecord } from '../../database/entities/employees/probation-record.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { LeaveBalance } from '../../database/entities/leave/leave-balance.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';
import { Requisition } from '../../database/entities/requisitions/requisition.entity';
import { TravelRequest } from '../../database/entities/travel/travel-request.entity';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';
import { ApprovalsService } from '../approvals/approvals.service';

const CONFIRMATIONS_DUE_WINDOW_DAYS = 14;

export interface DashboardSummary {
  pendingApprovalsForMe: number;
  employee: {
    todayStatus: string | null;
    leaveBalanceAvailable: number;
    myPendingCount: number;
  } | null;
  manager: {
    teamPresentToday: number;
    teamOnLeaveToday: number;
  } | null;
  hr: {
    totalEmployees: number;
    onLeaveToday: number;
    confirmationsDue: number;
  } | null;
  finance: {
    pendingReimbursementsCount: number;
    pendingReimbursementsTotal: number;
  } | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(ProbationRecord) private probationRepo: Repository<ProbationRecord>,
    @InjectRepository(AttendanceRecord) private attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(LeaveBalance) private leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveApplication) private leaveApplicationRepo: Repository<LeaveApplication>,
    @InjectRepository(Requisition) private requisitionRepo: Repository<Requisition>,
    @InjectRepository(TravelRequest) private travelRepo: Repository<TravelRequest>,
    @InjectRepository(ExpenseClaim) private expenseRepo: Repository<ExpenseClaim>,
    private approvalsService: ApprovalsService,
  ) {}

  async getSummary(userId: string, permissions: string[]): Promise<DashboardSummary> {
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();

    const pendingApprovals = await this.approvalsService.getMyPendingApprovals(userId);

    const employee = await this.employeeRepo.findOne({ where: { userId } });

    const summary: DashboardSummary = {
      pendingApprovalsForMe: pendingApprovals.length,
      employee: null,
      manager: null,
      hr: null,
      finance: null,
    };

    if (employee) {
      const [todayRecord, balances, myLeavePending, myRequisitionPending, myTravelPending, myExpensePending] = await Promise.all([
        this.attendanceRepo.findOne({ where: { employeeId: employee.id, workDate: today } }),
        this.leaveBalanceRepo.find({ where: { employeeId: employee.id, year } }),
        this.leaveApplicationRepo.count({ where: { employeeId: employee.id, status: LeaveApplicationStatus.Pending } }),
        this.requisitionRepo.count({ where: { requesterId: employee.id, status: RequisitionStatus.Pending } }),
        this.travelRepo.count({ where: { employeeId: employee.id, status: TravelRequestStatus.Pending } }),
        this.expenseRepo.count({ where: { employeeId: employee.id, status: ExpenseClaimStatus.Pending } }),
      ]);

      summary.employee = {
        todayStatus: todayRecord?.status ?? null,
        leaveBalanceAvailable: balances.reduce((sum, b) => sum + Number(b.available), 0),
        myPendingCount: myLeavePending + myRequisitionPending + myTravelPending + myExpensePending,
      };
    }

    if (employee && permissions.includes('attendance.viewAll')) {
      const directReports = await this.employeeRepo.find({ where: { lineManagerId: employee.id } });
      const reportIds = directReports.map((e) => e.id);

      if (reportIds.length > 0) {
        const [teamPresentToday, teamOnLeaveToday] = await Promise.all([
          this.attendanceRepo.count({
            where: { employeeId: In(reportIds), workDate: today, status: In([AttendanceStatus.Present, AttendanceStatus.Late]) },
          }),
          this.attendanceRepo.count({
            where: { employeeId: In(reportIds), workDate: today, status: AttendanceStatus.OnLeave },
          }),
        ]);
        summary.manager = { teamPresentToday, teamOnLeaveToday };
      } else {
        summary.manager = { teamPresentToday: 0, teamOnLeaveToday: 0 };
      }
    }

    if (permissions.includes('employee.readAll')) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + CONFIRMATIONS_DUE_WINDOW_DAYS);

      const [totalEmployees, onLeaveToday, confirmationsDue] = await Promise.all([
        this.employeeRepo.count({ where: { status: EmployeeStatus.Active } }),
        this.attendanceRepo.count({ where: { workDate: today, status: AttendanceStatus.OnLeave } }),
        this.probationRepo
          .createQueryBuilder('p')
          .where('p.status = :s', { s: ProbationStatus.InProbation })
          .andWhere('p.expected_confirmation_date <= :cutoff', { cutoff: cutoff.toISOString().slice(0, 10) })
          .getCount(),
      ]);

      summary.hr = { totalEmployees, onLeaveToday, confirmationsDue };
    }

    if (permissions.includes('expense.reimburse')) {
      const reimbursable = await this.expenseRepo.find({ where: { status: ExpenseClaimStatus.Approved } });
      summary.finance = {
        pendingReimbursementsCount: reimbursable.length,
        pendingReimbursementsTotal: reimbursable.reduce((sum, c) => sum + Number(c.totalAmount), 0),
      };
    }

    return summary;
  }
}
