import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ApprovalEntityType,
  LeaveApplicationStatus,
  LeaveLedgerSource,
} from '@hrm/types';
import { LeaveType } from '../../database/entities/leave/leave-type.entity';
import { LeavePolicy } from '../../database/entities/leave/leave-policy.entity';
import { LeaveBalance } from '../../database/entities/leave/leave-balance.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';
import { LeaveLedger } from '../../database/entities/leave/leave-ledger.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { ApprovalsService, ApprovalFinalizedEvent } from '../approvals/approvals.service';
import { LeaveCalculatorService } from './leave-calculator.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType) private leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(LeavePolicy) private leavePolicyRepo: Repository<LeavePolicy>,
    @InjectRepository(LeaveBalance) private leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveApplication) private leaveApplicationRepo: Repository<LeaveApplication>,
    @InjectRepository(LeaveLedger) private leaveLedgerRepo: Repository<LeaveLedger>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private approvalsService: ApprovalsService,
    private leaveCalculator: LeaveCalculatorService,
    private dataSource: DataSource,
  ) {}

  // ── Leave Types ─────────────────────────────────────────────────────────────

  findLeaveTypes(activeOnly = true) {
    return this.leaveTypeRepo.find({
      where: activeOnly ? { isActive: true } : {},
      order: { name: 'ASC' },
    });
  }

  async findLeaveTypeById(id: string) {
    const lt = await this.leaveTypeRepo.findOne({ where: { id } });
    if (!lt) throw new NotFoundException('Leave type not found');
    return lt;
  }

  async createLeaveType(dto: CreateLeaveTypeDto) {
    const existing = await this.leaveTypeRepo.findOne({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Leave type code "${dto.code}" is already in use`);
    return this.leaveTypeRepo.save(this.leaveTypeRepo.create({ ...dto }));
  }

  async updateLeaveType(id: string, dto: UpdateLeaveTypeDto) {
    const lt = await this.findLeaveTypeById(id);
    Object.assign(lt, dto);
    return this.leaveTypeRepo.save(lt);
  }

  async deactivateLeaveType(id: string) {
    await this.findLeaveTypeById(id);
    await this.leaveTypeRepo.update({ id }, { isActive: false });
  }

  // ── Leave Policies ──────────────────────────────────────────────────────────

  findLeavePolicies(leaveTypeId?: string) {
    return this.leavePolicyRepo.find({
      where: leaveTypeId ? { leaveTypeId } : {},
      relations: ['leaveType'],
      order: { createdAt: 'DESC' },
    });
  }

  async createLeavePolicy(dto: CreateLeavePolicyDto) {
    await this.findLeaveTypeById(dto.leaveTypeId);
    return this.leavePolicyRepo.save(this.leavePolicyRepo.create({ ...dto }));
  }

  async deleteLeavePolicy(id: string) {
    const policy = await this.leavePolicyRepo.findOne({ where: { id } });
    if (!policy) throw new NotFoundException('Leave policy not found');
    await this.leavePolicyRepo.delete({ id });
  }

  // ── Balances ────────────────────────────────────────────────────────────────

  async getMyBalances(userId: string, year?: number) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return this.getBalancesForEmployee(employee.id, year);
  }

  async getBalancesForEmployee(employeeId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    return this.leaveBalanceRepo.find({
      where: { employeeId, year: targetYear },
      relations: ['leaveType'],
      order: { leaveType: { name: 'ASC' } } as never,
    });
  }

  async getOrCreateBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ): Promise<LeaveBalance> {
    let balance = await this.leaveBalanceRepo.findOne({
      where: { employeeId, leaveTypeId, year },
    });
    if (!balance) {
      const leaveType = await this.leaveTypeRepo.findOne({ where: { id: leaveTypeId } });
      const entitled = leaveType?.defaultDaysPerYear ?? 0;
      balance = this.leaveBalanceRepo.create({
        employeeId,
        leaveTypeId,
        year,
        entitled: Number(entitled),
        accrued: Number(entitled),
        used: 0,
        pending: 0,
        carriedForward: 0,
        available: Number(entitled),
      });
      balance = await this.leaveBalanceRepo.save(balance);
    }
    return balance;
  }

  async adjustBalance(dto: AdjustBalanceDto) {
    return this.dataSource.transaction(async (em) => {
      let balance = await em.findOne(LeaveBalance, {
        where: { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: dto.year },
      });
      if (!balance) {
        balance = em.create(LeaveBalance, {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year,
          entitled: 0,
          accrued: 0,
          used: 0,
          pending: 0,
          carriedForward: 0,
          available: 0,
        });
      }
      balance.accrued = Number(balance.accrued) + dto.change;
      balance.available = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.used) - Number(balance.pending);
      balance = await em.save(LeaveBalance, balance);

      await em.save(LeaveLedger, em.create(LeaveLedger, {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        change: dto.change,
        balanceAfter: Number(balance.available),
        source: LeaveLedgerSource.Adjustment,
        refId: null,
      }));

      return balance;
    });
  }

  // ── Accrue Leave ────────────────────────────────────────────────────────────

  async accrueLeaveForMonth(year: number, month: number) {
    const leaveTypes = await this.leaveTypeRepo.find({
      where: { isActive: true },
    });
    const employees = await this.employeeRepo.find({ where: { status: 'active' as never } });

    let accrued = 0;
    for (const lt of leaveTypes) {
      if (lt.accrualMethod !== 'monthly') continue;
      const monthlyAmount = this.leaveCalculator.monthlyAccrualAmount(Number(lt.defaultDaysPerYear));
      if (monthlyAmount <= 0) continue;

      for (const emp of employees) {
        await this.dataSource.transaction(async (em) => {
          let balance = await em.findOne(LeaveBalance, {
            where: { employeeId: emp.id, leaveTypeId: lt.id, year },
          });
          if (!balance) {
            balance = em.create(LeaveBalance, {
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year,
              entitled: Number(lt.defaultDaysPerYear),
              accrued: 0,
              used: 0,
              pending: 0,
              carriedForward: 0,
              available: 0,
            });
          }
          balance.accrued = Number(balance.accrued) + monthlyAmount;
          balance.available = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.used) - Number(balance.pending);
          balance = await em.save(LeaveBalance, balance);

          await em.save(LeaveLedger, em.create(LeaveLedger, {
            employeeId: emp.id,
            leaveTypeId: lt.id,
            change: monthlyAmount,
            balanceAfter: Number(balance.available),
            source: LeaveLedgerSource.Accrual,
            refId: null,
          }));
          accrued++;
        });
      }
    }
    return { accrued, year, month };
  }

  // ── Leave Applications ──────────────────────────────────────────────────────

  async previewDays(startDate: string, endDate: string, isHalfDay: boolean) {
    if (new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException('End date must be on or after start date');
    }
    const days = await this.leaveCalculator.countWorkingDays(startDate, endDate, isHalfDay);
    return { days };
  }

  async applyForLeave(userId: string, dto: ApplyLeaveDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const leaveType = await this.leaveTypeRepo.findOne({ where: { id: dto.leaveTypeId, isActive: true } });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    if (leaveType.requiresDocument && !dto.documentUrl) {
      throw new BadRequestException(`Leave type "${leaveType.name}" requires a supporting document`);
    }

    const year = new Date(dto.startDate).getFullYear();
    const daysCount = await this.leaveCalculator.countWorkingDays(
      dto.startDate,
      dto.endDate,
      dto.isHalfDay ?? false,
    );

    if (daysCount <= 0) {
      throw new BadRequestException('No working days in the selected date range');
    }

    return this.dataSource.transaction(async (em) => {
      // Check for overlapping pending/approved applications
      const overlap = await em
        .createQueryBuilder(LeaveApplication, 'la')
        .where('la.employee_id = :eid', { eid: employee.id })
        .andWhere('la.status IN (:...statuses)', {
          statuses: [LeaveApplicationStatus.Pending, LeaveApplicationStatus.Approved],
        })
        .andWhere('la.start_date <= :end AND la.end_date >= :start', {
          start: dto.startDate,
          end: dto.endDate,
        })
        .getCount();

      if (overlap > 0) {
        throw new BadRequestException('You already have a leave application covering these dates');
      }

      // Balance check
      let balance = await em.findOne(LeaveBalance, {
        where: { employeeId: employee.id, leaveTypeId: dto.leaveTypeId, year },
      });
      if (!balance) {
        balance = em.create(LeaveBalance, {
          employeeId: employee.id,
          leaveTypeId: dto.leaveTypeId,
          year,
          entitled: Number(leaveType.defaultDaysPerYear),
          accrued: Number(leaveType.defaultDaysPerYear),
          used: 0,
          pending: 0,
          carriedForward: 0,
          available: Number(leaveType.defaultDaysPerYear),
        });
        balance = await em.save(LeaveBalance, balance);
      }

      if (!leaveType.allowNegativeBalance && Number(balance.available) < daysCount) {
        throw new BadRequestException(
          `Insufficient ${leaveType.name} balance. Available: ${balance.available}, Requested: ${daysCount}`,
        );
      }

      // Create application first so the approval has a real entity id to reference
      // (Approval.entityId is a uuid column — it cannot hold a placeholder value).
      const application = await em.save(LeaveApplication, em.create(LeaveApplication, {
        employeeId: employee.id,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        daysCount,
        isHalfDay: dto.isHalfDay ?? false,
        reason: dto.reason ?? null,
        documentUrl: dto.documentUrl ?? null,
        status: LeaveApplicationStatus.Pending,
        approvalId: null,
      }));

      const approval = await this.approvalsService.start({
        entityType: ApprovalEntityType.Leave,
        entityId: application.id,
        requesterId: userId,
        metricValue: daysCount,
      });

      await em.update(LeaveApplication, { id: application.id }, { approvalId: approval.id });
      application.approvalId = approval.id;

      // Reserve pending balance
      balance.pending = Number(balance.pending) + daysCount;
      balance.available = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.used) - Number(balance.pending);
      await em.save(LeaveBalance, balance);

      return application;
    });
  }

  async cancelApplication(id: string, userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const application = await this.leaveApplicationRepo.findOne({ where: { id } });
    if (!application) throw new NotFoundException('Leave application not found');

    if (application.employeeId !== employee.id) {
      throw new ForbiddenException('You can only cancel your own leave applications');
    }

    if (![LeaveApplicationStatus.Draft, LeaveApplicationStatus.Pending].includes(application.status)) {
      throw new BadRequestException(`Cannot cancel an application with status "${application.status}"`);
    }

    return this.dataSource.transaction(async (em) => {
      await em.update(LeaveApplication, { id }, { status: LeaveApplicationStatus.Cancelled });

      // Cancel the approval if pending
      if (application.approvalId) {
        await this.approvalsService.cancelApproval(application.approvalId).catch(() => undefined);
      }

      // Release pending balance
      if (application.status === LeaveApplicationStatus.Pending) {
        const year = new Date(application.startDate).getFullYear();
        const balance = await em.findOne(LeaveBalance, {
          where: { employeeId: employee.id, leaveTypeId: application.leaveTypeId, year },
        });
        if (balance) {
          balance.pending = Math.max(0, Number(balance.pending) - Number(application.daysCount));
          balance.available = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.used) - Number(balance.pending);
          await em.save(LeaveBalance, balance);
        }
      }
    });
  }

  async getMyApplications(userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return this.leaveApplicationRepo.find({
      where: { employeeId: employee.id },
      relations: ['leaveType', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllApplications(status?: string) {
    return this.leaveApplicationRepo.find({
      where: status ? { status: status as LeaveApplicationStatus } : {},
      relations: ['employee', 'leaveType', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTeamApplications(userId: string, year: number, month: number) {
    const manager = await this.employeeRepo.findOne({ where: { userId } });
    if (!manager) throw new NotFoundException('Employee profile not found');

    const directReports = await this.employeeRepo.find({
      where: { lineManagerId: manager.id },
    });
    if (directReports.length === 0) return [];

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const empIds = directReports.map((e) => e.id);
    return this.leaveApplicationRepo
      .createQueryBuilder('la')
      .innerJoinAndSelect('la.employee', 'emp')
      .innerJoinAndSelect('la.leaveType', 'lt')
      .where('la.employee_id = ANY(:ids)', { ids: empIds })
      .andWhere('la.status IN (:...statuses)', {
        statuses: [LeaveApplicationStatus.Pending, LeaveApplicationStatus.Approved],
      })
      .andWhere('la.start_date <= :end AND la.end_date >= :start', { start: startDate, end: endDate })
      .orderBy('la.start_date', 'ASC')
      .getMany();
  }

  async getLedger(employeeId: string) {
    return this.leaveLedgerRepo.find({
      where: { employeeId },
      relations: ['leaveType'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // ── Approval event listeners ────────────────────────────────────────────────

  @OnEvent('approval.approved')
  async handleApprovalApproved(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.Leave) return;

    const application = await this.leaveApplicationRepo.findOne({ where: { id: event.entityId } });
    if (!application) return;

    await this.dataSource.transaction(async (em) => {
      await em.update(LeaveApplication, { id: application.id }, {
        status: LeaveApplicationStatus.Approved,
      });

      const year = new Date(application.startDate).getFullYear();
      const balance = await em.findOne(LeaveBalance, {
        where: { employeeId: application.employeeId, leaveTypeId: application.leaveTypeId, year },
      });
      if (!balance) return;

      const days = Number(application.daysCount);
      balance.pending = Math.max(0, Number(balance.pending) - days);
      balance.used = Number(balance.used) + days;
      balance.available = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.used) - Number(balance.pending);
      await em.save(LeaveBalance, balance);

      await em.save(LeaveLedger, em.create(LeaveLedger, {
        employeeId: application.employeeId,
        leaveTypeId: application.leaveTypeId,
        change: -days,
        balanceAfter: Number(balance.available),
        source: LeaveLedgerSource.Application,
        refId: application.id,
      }));
    });
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.Leave) return;

    const application = await this.leaveApplicationRepo.findOne({ where: { id: event.entityId } });
    if (!application) return;

    await this.dataSource.transaction(async (em) => {
      await em.update(LeaveApplication, { id: application.id }, {
        status: LeaveApplicationStatus.Rejected,
      });

      const year = new Date(application.startDate).getFullYear();
      const balance = await em.findOne(LeaveBalance, {
        where: { employeeId: application.employeeId, leaveTypeId: application.leaveTypeId, year },
      });
      if (!balance) return;

      const days = Number(application.daysCount);
      balance.pending = Math.max(0, Number(balance.pending) - days);
      balance.available = Number(balance.accrued) + Number(balance.carriedForward) - Number(balance.used) - Number(balance.pending);
      await em.save(LeaveBalance, balance);
    });
  }
}
