import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between, FindOptionsWhere } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ApprovalEntityType,
  ApprovalAction as ApprovalActionType,
  AttendanceSource,
  AttendanceStatus,
  LeaveApplicationStatus,
  RegularizationStatus,
} from '@hrm/types';
import { Shift } from '../../database/entities/attendance/shift.entity';
import { Roster } from '../../database/entities/attendance/roster.entity';
import { RosterAssignment } from '../../database/entities/attendance/roster-assignment.entity';
import { Holiday } from '../../database/entities/attendance/holiday.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { AttendanceRegularization } from '../../database/entities/attendance/attendance-regularization.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';
import { ApprovalsService, ApprovalFinalizedEvent } from '../approvals/approvals.service';
import { SettingsService } from '../settings/settings.service';
import { AttendanceResolverService } from './attendance-resolver.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/create-shift.dto';
import { CreateRosterDto } from './dto/create-roster.dto';
import { AssignRosterDto } from './dto/assign-roster.dto';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/create-holiday.dto';
import { ManualEntryDto } from './dto/manual-entry.dto';
import { CreateRegularizationDto } from './dto/create-regularization.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(Roster) private rosterRepo: Repository<Roster>,
    @InjectRepository(RosterAssignment) private rosterAssignmentRepo: Repository<RosterAssignment>,
    @InjectRepository(Holiday) private holidayRepo: Repository<Holiday>,
    @InjectRepository(AttendanceRecord) private recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(AttendanceRegularization) private regularizationRepo: Repository<AttendanceRegularization>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(LeaveApplication) private leaveApplicationRepo: Repository<LeaveApplication>,
    @InjectRepository(ApprovalActionRecord) private approvalActionRepo: Repository<ApprovalActionRecord>,
    private approvalsService: ApprovalsService,
    private resolver: AttendanceResolverService,
    private dataSource: DataSource,
    private settingsService: SettingsService,
  ) {}

  // ── Shifts ──────────────────────────────────────────────────────────────────

  findShifts() {
    return this.shiftRepo.find({ order: { name: 'ASC' } });
  }

  async createShift(dto: CreateShiftDto) {
    return this.shiftRepo.save(this.shiftRepo.create({ ...dto, workingHours: String(dto.workingHours) }));
  }

  async updateShift(id: string, dto: UpdateShiftDto) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    Object.assign(shift, {
      ...dto,
      ...(dto.workingHours !== undefined && { workingHours: String(dto.workingHours) }),
    });
    return this.shiftRepo.save(shift);
  }

  async deleteShift(id: string) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    await this.shiftRepo.remove(shift);
  }

  // ── Rosters ─────────────────────────────────────────────────────────────────

  findRosters() {
    return this.rosterRepo.find({ relations: ['department'], order: { name: 'ASC' } });
  }

  async createRoster(dto: CreateRosterDto) {
    return this.rosterRepo.save(this.rosterRepo.create({ ...dto }));
  }

  async getRosterAssignments(rosterId: string) {
    await this.findRosterById(rosterId);
    return this.rosterAssignmentRepo.find({
      where: { rosterId },
      relations: ['employee', 'shift'],
      order: { workDate: 'ASC' },
    });
  }

  async assignRoster(rosterId: string, dto: AssignRosterDto) {
    await this.findRosterById(rosterId);
    if (dto.assignments.length === 0) {
      throw new BadRequestException('At least one assignment is required');
    }

    return this.dataSource.transaction(async (em) => {
      const rows = dto.assignments.map((a) =>
        em.create(RosterAssignment, {
          rosterId,
          employeeId: a.employeeId,
          shiftId: a.shiftId,
          workDate: a.workDate,
        }),
      );
      await em.upsert(RosterAssignment, rows, {
        conflictPaths: ['rosterId', 'employeeId', 'workDate'],
      });
      return em.find(RosterAssignment, {
        where: { rosterId },
        relations: ['employee', 'shift'],
        order: { workDate: 'ASC' },
      });
    });
  }

  private async findRosterById(id: string) {
    const roster = await this.rosterRepo.findOne({ where: { id } });
    if (!roster) throw new NotFoundException('Roster not found');
    return roster;
  }

  // ── Holidays ────────────────────────────────────────────────────────────────

  findHolidays() {
    return this.holidayRepo.find({ order: { date: 'ASC' } });
  }

  async createHoliday(dto: CreateHolidayDto) {
    return this.holidayRepo.save(this.holidayRepo.create({ ...dto }));
  }

  async updateHoliday(id: string, dto: UpdateHolidayDto) {
    const holiday = await this.holidayRepo.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    Object.assign(holiday, dto);
    return this.holidayRepo.save(holiday);
  }

  async deleteHoliday(id: string) {
    const holiday = await this.holidayRepo.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    await this.holidayRepo.remove(holiday);
  }

  // ── Clock in/out & manual entry ─────────────────────────────────────────────

  async clockIn(userId: string) {
    const employee = await this.findEmployeeByUserId(userId);
    const workDate = await this.today();

    const existing = await this.recordRepo.findOne({ where: { employeeId: employee.id, workDate } });
    if (existing?.checkInAt) {
      throw new BadRequestException('You have already clocked in today');
    }

    if (existing) {
      existing.checkInAt = new Date();
      existing.source = AttendanceSource.Web;
      await this.recordRepo.save(existing);
    } else {
      await this.recordRepo.save(
        this.recordRepo.create({
          employeeId: employee.id,
          workDate,
          checkInAt: new Date(),
          checkOutAt: null,
          source: AttendanceSource.Web,
          status: AttendanceStatus.Present, // resolved immediately below
        }),
      );
    }

    return this.resolver.resolveDay(employee.id, workDate);
  }

  async clockOut(userId: string) {
    const employee = await this.findEmployeeByUserId(userId);
    const workDate = await this.today();

    const record = await this.recordRepo.findOne({ where: { employeeId: employee.id, workDate } });
    if (!record?.checkInAt) {
      throw new BadRequestException('You have not clocked in today');
    }
    if (record.checkOutAt) {
      throw new BadRequestException('You have already clocked out today');
    }

    record.checkOutAt = new Date();
    await this.recordRepo.save(record);

    return this.resolver.resolveDay(employee.id, workDate);
  }

  async manualEntry(dto: ManualEntryDto) {
    const employee = await this.employeeRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const existing = await this.recordRepo.findOne({
      where: { employeeId: dto.employeeId, workDate: dto.workDate },
    });

    const fields = {
      employeeId: dto.employeeId,
      workDate: dto.workDate,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : null,
      checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : null,
      source: AttendanceSource.Manual,
      note: dto.note ?? null,
    };

    if (existing) {
      Object.assign(existing, fields);
      await this.recordRepo.save(existing);
    } else {
      await this.recordRepo.save(this.recordRepo.create({ ...fields, status: AttendanceStatus.Present }));
    }

    return this.resolver.resolveDay(dto.employeeId, dto.workDate);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getMyAttendance(userId: string, year: number, month: number) {
    const employee = await this.findEmployeeByUserId(userId);
    return this.getAttendanceForEmployee(employee.id, year, month);
  }

  async getAttendanceForEmployee(employeeId: string, year: number, month: number) {
    const { startDate, endDate } = this.monthRange(year, month);
    return this.recordRepo.find({
      where: { employeeId, workDate: Between(startDate, endDate) },
      order: { workDate: 'ASC' },
    });
  }

  async getTeamAttendance(
    userId: string,
    startDate: string,
    endDate: string,
    departmentId: string | undefined,
    canViewAll: boolean,
  ) {
    const manager = await this.findEmployeeByUserId(userId);

    // Only a caller with AttendanceViewAll may filter by an arbitrary department —
    // everyone else is always scoped to their own direct reports, regardless of
    // what departmentId they pass, so this endpoint can't be used to see other teams.
    const where: FindOptionsWhere<Employee> = departmentId && canViewAll
      ? { departmentId }
      : { lineManagerId: manager.id };

    const employees = await this.employeeRepo.find({ where });
    if (employees.length === 0) return [];

    const empIds = employees.map((e) => e.id);
    return this.recordRepo.find({
      where: {
        employeeId: In(empIds),
        workDate: Between(startDate, endDate),
      },
      relations: ['employee'],
      order: { workDate: 'ASC' },
    });
  }

  // ── Regularization ──────────────────────────────────────────────────────────

  async requestRegularization(userId: string, dto: CreateRegularizationDto) {
    const employee = await this.findEmployeeByUserId(userId);

    const record = await this.recordRepo.findOne({ where: { id: dto.attendanceRecordId } });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (record.employeeId !== employee.id) {
      throw new ForbiddenException('You can only request corrections for your own attendance');
    }

    return this.dataSource.transaction(async (em) => {
      const regularization = await em.save(
        AttendanceRegularization,
        em.create(AttendanceRegularization, {
          attendanceRecordId: record.id,
          reason: dto.reason,
          requestedBy: employee.id,
          status: RegularizationStatus.Pending,
          requestedCheckInAt: dto.requestedCheckInAt ? new Date(dto.requestedCheckInAt) : null,
          requestedCheckOutAt: dto.requestedCheckOutAt ? new Date(dto.requestedCheckOutAt) : null,
        }),
      );

      const approval = await this.approvalsService.start({
        entityType: ApprovalEntityType.Regularization,
        entityId: regularization.id,
        requesterId: userId,
      });

      await em.update(AttendanceRegularization, { id: regularization.id }, { approvalId: approval.id });

      return { ...regularization, approvalId: approval.id };
    });
  }

  async getMyRegularizations(userId: string) {
    const employee = await this.findEmployeeByUserId(userId);
    return this.regularizationRepo.find({
      where: { requestedBy: employee.id },
      relations: ['attendanceRecord', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  getAllRegularizations() {
    return this.regularizationRepo.find({
      relations: ['attendanceRecord', 'requester', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  // ── Approval event listeners ────────────────────────────────────────────────

  @OnEvent('approval.approved')
  async handleRegularizationApproved(event: ApprovalFinalizedEvent) {
    if (event.entityType === ApprovalEntityType.Regularization) {
      await this.applyRegularizationDecision(event, RegularizationStatus.Approved);
    } else if (event.entityType === ApprovalEntityType.Leave) {
      await this.markLeaveDays(event.entityId);
    }
  }

  @OnEvent('approval.rejected')
  async handleRegularizationRejected(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.Regularization) return;
    await this.applyRegularizationDecision(event, RegularizationStatus.Rejected);
  }

  private async applyRegularizationDecision(event: ApprovalFinalizedEvent, status: RegularizationStatus) {
    const regularization = await this.regularizationRepo.findOne({
      where: { id: event.entityId },
      relations: ['attendanceRecord'],
    });
    if (!regularization) return;

    await this.dataSource.transaction(async (em) => {
      await em.update(AttendanceRegularization, { id: regularization.id }, { status });

      if (status === RegularizationStatus.Approved) {
        const lastApproveAction = await this.approvalActionRepo.findOne({
          where: { approvalId: event.approvalId, action: ApprovalActionType.Approve },
          order: { actedAt: 'DESC' },
        });

        await em.update(
          AttendanceRecord,
          { id: regularization.attendanceRecordId },
          {
            checkInAt: regularization.requestedCheckInAt ?? regularization.attendanceRecord.checkInAt,
            checkOutAt: regularization.requestedCheckOutAt ?? regularization.attendanceRecord.checkOutAt,
            regularizedBy: lastApproveAction?.actorId ?? null,
          },
        );
      }
    });

    if (status === RegularizationStatus.Approved) {
      await this.resolver.resolveDay(
        regularization.attendanceRecord.employeeId,
        regularization.attendanceRecord.workDate,
      );
    }
  }

  private async markLeaveDays(leaveApplicationId: string) {
    const application = await this.leaveApplicationRepo.findOne({ where: { id: leaveApplicationId } });
    if (!application || application.status !== LeaveApplicationStatus.Approved) return;

    const cur = new Date(application.startDate);
    const end = new Date(application.endDate);
    while (cur <= end) {
      const workDate = cur.toISOString().slice(0, 10);
      await this.resolver.resolveDay(application.employeeId, workDate);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findEmployeeByUserId(userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return employee;
  }

  /** "Today" resolved in the org's configured timezone, not the server's local time. */
  private async today(): Promise<string> {
    const tz = await this.settingsService.getValue('timezone', 'UTC');
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private monthRange(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }

}
