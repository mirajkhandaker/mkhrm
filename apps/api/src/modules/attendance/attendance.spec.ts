import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AttendanceResolverService } from './attendance-resolver.service';
import { AttendanceService } from './attendance.service';
import { Schedule } from '../../database/entities/attendance/schedule.entity';
import { Holiday } from '../../database/entities/attendance/holiday.entity';
import { Setting } from '../../database/entities/system/setting.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { AttendanceRegularization } from '../../database/entities/attendance/attendance-regularization.entity';
import { RosterAssignment } from '../../database/entities/attendance/roster-assignment.entity';
import { Roster } from '../../database/entities/attendance/roster.entity';
import { Shift } from '../../database/entities/attendance/shift.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';
import { ApprovalsService } from '../approvals/approvals.service';
import { SettingsService } from '../settings/settings.service';
import {
  AttendanceSource,
  AttendanceStatus,
  LeaveApplicationStatus,
  RegularizationStatus,
  ApprovalEntityType,
  ApprovalStatus,
  ApprovalAction,
} from '@hrm/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPLOYEE_ID = 'emp-1';
const WORK_DATE = '2026-07-06'; // a Monday

const FIXED_SHIFT: Shift = {
  id: 'shift-1',
  name: 'General Shift',
  type: 'fixed' as never,
  startTime: '09:00:00',
  endTime: '17:00:00',
  graceMinutes: 15,
  halfDayThresholdMinutes: 240,
  workingHours: '8',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
  };
}

async function buildService(overrides: {
  schedule?: unknown;
  holiday?: unknown;
  leave?: unknown;
  record?: unknown;
  rosterAssignment?: unknown;
  workingWeek?: number[];
}) {
  const scheduleRepo = makeRepo();
  scheduleRepo.findOne.mockResolvedValue(overrides.schedule ?? null);

  const holidayRepo = makeRepo();
  holidayRepo.findOne.mockResolvedValue(overrides.holiday ?? null);

  const settingRepo = makeRepo();
  settingRepo.findOne.mockResolvedValue({
    key: 'working_week',
    value: overrides.workingWeek ?? [0, 1, 2, 3, 4],
  });

  const recordRepo = makeRepo();
  recordRepo.findOne.mockResolvedValue(overrides.record ?? null);

  const rosterAssignmentRepo = makeRepo();
  rosterAssignmentRepo.findOne.mockResolvedValue(overrides.rosterAssignment ?? null);

  const leaveApplicationRepo = makeRepo();
  leaveApplicationRepo.findOne.mockResolvedValue(overrides.leave ?? null);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AttendanceResolverService,
      { provide: getRepositoryToken(Schedule), useValue: scheduleRepo },
      { provide: getRepositoryToken(Holiday), useValue: holidayRepo },
      { provide: getRepositoryToken(Setting), useValue: settingRepo },
      { provide: getRepositoryToken(AttendanceRecord), useValue: recordRepo },
      { provide: getRepositoryToken(RosterAssignment), useValue: rosterAssignmentRepo },
      { provide: getRepositoryToken(LeaveApplication), useValue: leaveApplicationRepo },
    ],
  }).compile();

  return { svc: module.get(AttendanceResolverService), recordRepo };
}

function punchRecord(checkInAt: string | null, checkOutAt: string | null) {
  return {
    id: 'rec-1',
    employeeId: EMPLOYEE_ID,
    workDate: WORK_DATE,
    checkInAt: checkInAt ? new Date(checkInAt) : null,
    checkOutAt: checkOutAt ? new Date(checkOutAt) : null,
    source: AttendanceSource.Web,
    status: AttendanceStatus.Present,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workedMinutes: 0,
    note: null,
    importBatchId: null,
    regularizedBy: null,
  };
}

describe('AttendanceResolverService.resolveDay', () => {
  it('marks an unscheduled day outside the working week as weekend', async () => {
    // 2026-07-04 is a Saturday
    const { svc } = await buildService({});
    const result = await svc.resolveDay(EMPLOYEE_ID, '2026-07-04');
    expect(result.status).toBe(AttendanceStatus.Weekend);
  });

  it('falls through to absent when there is no schedule at all but the weekday is a working day', async () => {
    // WORK_DATE (2026-07-06) is a Monday, included in the default working_week [0..4] —
    // distinct from the "no schedule at all" Weekend case above, which uses an excluded day.
    const { svc } = await buildService({});
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.Absent);
  });

  it('marks a day as weekend when the schedule explicitly flags it', async () => {
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: true, isHoliday: false, shift: null },
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.Weekend);
  });

  it('marks a day with a matching holiday as holiday', async () => {
    const { svc } = await buildService({
      holiday: { id: 'hol-1', name: 'Founders Day', date: WORK_DATE, type: 'company', isRecurring: false },
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.Holiday);
  });

  it('marks a day covered by an approved leave application as on_leave', async () => {
    const { svc } = await buildService({
      leave: {
        id: 'leave-1',
        employeeId: EMPLOYEE_ID,
        status: LeaveApplicationStatus.Approved,
        startDate: WORK_DATE,
        endDate: WORK_DATE,
      },
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.OnLeave);
  });

  it('marks a working day with no punch as absent', async () => {
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: false, isHoliday: false, shift: FIXED_SHIFT },
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.Absent);
  });

  it('marks an on-time check-in within grace as present with zero late minutes', async () => {
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: false, isHoliday: false, shift: FIXED_SHIFT },
      record: punchRecord(`${WORK_DATE}T09:10:00`, `${WORK_DATE}T17:00:00`),
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.Present);
    expect(result.lateMinutes).toBe(0);
  });

  it('marks a check-in past the grace deadline as late with exact minutes', async () => {
    // shift 09:00, grace 15 -> deadline 09:15; check-in 09:20 -> 5 minutes late
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: false, isHoliday: false, shift: FIXED_SHIFT },
      record: punchRecord(`${WORK_DATE}T09:20:00`, `${WORK_DATE}T17:00:00`),
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.Late);
    expect(result.lateMinutes).toBe(5);
  });

  it('computes early-leave minutes when check-out is before shift end', async () => {
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: false, isHoliday: false, shift: FIXED_SHIFT },
      record: punchRecord(`${WORK_DATE}T09:00:00`, `${WORK_DATE}T16:30:00`),
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.earlyLeaveMinutes).toBe(30);
  });

  it('marks a day as half_day when worked minutes are below the threshold, overriding present', async () => {
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: false, isHoliday: false, shift: FIXED_SHIFT },
      record: punchRecord(`${WORK_DATE}T09:00:00`, `${WORK_DATE}T12:00:00`), // 180 min < 240 threshold
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.HalfDay);
    expect(result.workedMinutes).toBe(180);
  });

  it('marks present with computed worked minutes when punched but no shift is configured', async () => {
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: false, isHoliday: false, shift: null },
      record: punchRecord(`${WORK_DATE}T09:00:00`, `${WORK_DATE}T17:00:00`),
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.Present);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.workedMinutes).toBe(480);
  });

  it('resolves half_day over late when check-in is late AND worked time is short (documented precedence)', async () => {
    const { svc } = await buildService({
      schedule: { employeeId: EMPLOYEE_ID, workDate: WORK_DATE, isWeekend: false, isHoliday: false, shift: FIXED_SHIFT },
      record: punchRecord(`${WORK_DATE}T09:30:00`, `${WORK_DATE}T11:00:00`), // late AND only 90 min worked
    });
    const result = await svc.resolveDay(EMPLOYEE_ID, WORK_DATE);
    expect(result.status).toBe(AttendanceStatus.HalfDay);
    expect(result.lateMinutes).toBeGreaterThan(0);
  });
});

describe('AttendanceService — regularization approval events', () => {
  const RECORD_ID = 'rec-1';
  const REG_ID = 'reg-1';
  const APPROVAL_ID = 'appr-1';

  function makeRepo() {
    return {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
      create: jest.fn().mockImplementation((e: unknown) => e),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
  }

  async function buildAttendanceService() {
    const regularizationRepo = makeRepo();
    const approvalActionRepo = makeRepo();
    const resolver = { resolveDay: jest.fn().mockResolvedValue(undefined) };
    const em = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation((_e: unknown, v: unknown) => Promise.resolve(v)),
      create: jest.fn().mockImplementation((_e: unknown, v: unknown) => v),
    };
    const dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (em: unknown) => unknown) => cb(em)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(Shift), useValue: makeRepo() },
        { provide: getRepositoryToken(Roster), useValue: makeRepo() },
        { provide: getRepositoryToken(RosterAssignment), useValue: makeRepo() },
        { provide: getRepositoryToken(Holiday), useValue: makeRepo() },
        { provide: getRepositoryToken(AttendanceRecord), useValue: makeRepo() },
        { provide: getRepositoryToken(AttendanceRegularization), useValue: regularizationRepo },
        { provide: getRepositoryToken(Employee), useValue: makeRepo() },
        { provide: getRepositoryToken(LeaveApplication), useValue: makeRepo() },
        { provide: getRepositoryToken(ApprovalActionRecord), useValue: approvalActionRepo },
        { provide: ApprovalsService, useValue: { start: jest.fn() } },
        { provide: AttendanceResolverService, useValue: resolver },
        { provide: DataSource, useValue: dataSource },
        { provide: SettingsService, useValue: { getValue: jest.fn().mockResolvedValue('UTC') } },
      ],
    }).compile();

    return { svc: module.get(AttendanceService), regularizationRepo, approvalActionRepo, em, resolver };
  }

  function makeRegularization() {
    return {
      id: REG_ID,
      attendanceRecordId: RECORD_ID,
      requestedCheckInAt: new Date(`${WORK_DATE}T09:00:00`),
      requestedCheckOutAt: new Date(`${WORK_DATE}T17:00:00`),
      attendanceRecord: {
        employeeId: EMPLOYEE_ID,
        workDate: WORK_DATE,
        checkInAt: new Date(`${WORK_DATE}T09:45:00`),
        checkOutAt: new Date(`${WORK_DATE}T17:00:00`),
      },
    };
  }

  it('approval.approved applies the requested times, sets regularizedBy, marks it Approved, and re-resolves the day', async () => {
    const { svc, regularizationRepo, approvalActionRepo, em, resolver } = await buildAttendanceService();
    const regularization = makeRegularization();
    regularizationRepo.findOne.mockResolvedValue(regularization);
    approvalActionRepo.findOne.mockResolvedValue({ actorId: 'user-mgr', action: ApprovalAction.Approve });

    await svc.handleRegularizationApproved({
      entityType: ApprovalEntityType.Regularization,
      entityId: REG_ID,
      approvalId: APPROVAL_ID,
      status: ApprovalStatus.Approved,
      requestedBy: 'user-emp',
    });

    expect(em.update).toHaveBeenCalledWith(
      AttendanceRegularization,
      { id: REG_ID },
      { status: RegularizationStatus.Approved },
    );
    expect(em.update).toHaveBeenCalledWith(
      AttendanceRecord,
      { id: RECORD_ID },
      {
        checkInAt: regularization.requestedCheckInAt,
        checkOutAt: regularization.requestedCheckOutAt,
        regularizedBy: 'user-mgr',
      },
    );
    expect(resolver.resolveDay).toHaveBeenCalledWith(EMPLOYEE_ID, WORK_DATE);
  });

  it('approval.rejected only flips the regularization to Rejected and leaves the attendance record untouched', async () => {
    const { svc, regularizationRepo, em, resolver } = await buildAttendanceService();
    regularizationRepo.findOne.mockResolvedValue(makeRegularization());

    await svc.handleRegularizationRejected({
      entityType: ApprovalEntityType.Regularization,
      entityId: REG_ID,
      approvalId: APPROVAL_ID,
      status: ApprovalStatus.Rejected,
      requestedBy: 'user-emp',
    });

    expect(em.update).toHaveBeenCalledTimes(1);
    expect(em.update).toHaveBeenCalledWith(
      AttendanceRegularization,
      { id: REG_ID },
      { status: RegularizationStatus.Rejected },
    );
    expect(resolver.resolveDay).not.toHaveBeenCalled();
  });
});
