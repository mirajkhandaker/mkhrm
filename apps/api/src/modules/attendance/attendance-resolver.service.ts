import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AttendanceSource, AttendanceStatus, LeaveApplicationStatus } from '@hrm/types';
import { Schedule } from '../../database/entities/attendance/schedule.entity';
import { Holiday } from '../../database/entities/attendance/holiday.entity';
import { Setting } from '../../database/entities/system/setting.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { RosterAssignment } from '../../database/entities/attendance/roster-assignment.entity';
import { Shift } from '../../database/entities/attendance/shift.entity';
import { LeaveApplication } from '../../database/entities/leave/leave-application.entity';

@Injectable()
export class AttendanceResolverService {
  constructor(
    @InjectRepository(Schedule) private scheduleRepo: Repository<Schedule>,
    @InjectRepository(Holiday) private holidayRepo: Repository<Holiday>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    @InjectRepository(AttendanceRecord) private recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(RosterAssignment) private rosterAssignmentRepo: Repository<RosterAssignment>,
    @InjectRepository(LeaveApplication) private leaveApplicationRepo: Repository<LeaveApplication>,
  ) {}

  /**
   * §9 daily status resolver: weekend > holiday > approved leave > punch-based.
   * Re-run after clock-in (so `late` shows immediately), clock-out, an import commit,
   * and when a leave application is approved for a date it covers.
   */
  async resolveDay(employeeId: string, workDate: string): Promise<AttendanceRecord> {
    const [schedule, holiday, leave, record] = await Promise.all([
      this.scheduleRepo.findOne({ where: { employeeId, workDate }, relations: ['shift'] }),
      this.holidayRepo.findOne({ where: { date: workDate } }),
      this.leaveApplicationRepo.findOne({
        where: {
          employeeId,
          status: LeaveApplicationStatus.Approved,
          startDate: LessThanOrEqual(workDate),
          endDate: MoreThanOrEqual(workDate),
        },
      }),
      this.recordRepo.findOne({ where: { employeeId, workDate } }),
    ]);

    let status: AttendanceStatus;
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let workedMinutes = 0;

    if (schedule?.isWeekend || (!schedule && !(await this.isWorkingWeekday(workDate)))) {
      status = AttendanceStatus.Weekend;
    } else if (holiday || schedule?.isHoliday) {
      status = AttendanceStatus.Holiday;
    } else if (leave) {
      status = AttendanceStatus.OnLeave;
    } else if (!record?.checkInAt) {
      status = AttendanceStatus.Absent;
    } else {
      let shift: Shift | null = schedule?.shift ?? null;
      if (!shift) {
        const rosterAssignment = await this.rosterAssignmentRepo.findOne({
          where: { employeeId, workDate },
          relations: ['shift'],
        });
        shift = rosterAssignment?.shift ?? null;
      }

      let isLate = false;
      if (shift) {
        const shiftStart = this.combine(workDate, shift.startTime);
        const graceDeadline = new Date(shiftStart.getTime() + shift.graceMinutes * 60_000);
        isLate = record.checkInAt > graceDeadline;
        if (isLate) {
          lateMinutes = Math.round((record.checkInAt.getTime() - graceDeadline.getTime()) / 60_000);
        }

        if (record.checkOutAt) {
          const shiftEnd = this.combine(workDate, shift.endTime);
          if (record.checkOutAt < shiftEnd) {
            earlyLeaveMinutes = Math.round((shiftEnd.getTime() - record.checkOutAt.getTime()) / 60_000);
          }
          workedMinutes = Math.round((record.checkOutAt.getTime() - record.checkInAt.getTime()) / 60_000);
        }

        // Precedence tie-break (not specified in §9): half_day overrides late when worked
        // time is short; late overrides present when worked time is otherwise sufficient.
        if (workedMinutes > 0 && workedMinutes < shift.halfDayThresholdMinutes) {
          status = AttendanceStatus.HalfDay;
        } else if (isLate) {
          status = AttendanceStatus.Late;
        } else {
          status = AttendanceStatus.Present;
        }
      } else {
        if (record.checkOutAt) {
          workedMinutes = Math.round((record.checkOutAt.getTime() - record.checkInAt.getTime()) / 60_000);
        }
        status = AttendanceStatus.Present;
      }
    }

    return this.upsertDerived(employeeId, workDate, record, status, lateMinutes, earlyLeaveMinutes, workedMinutes);
  }

  private async upsertDerived(
    employeeId: string,
    workDate: string,
    existing: AttendanceRecord | null,
    status: AttendanceStatus,
    lateMinutes: number,
    earlyLeaveMinutes: number,
    workedMinutes: number,
  ): Promise<AttendanceRecord> {
    if (existing) {
      existing.status = status;
      existing.lateMinutes = lateMinutes;
      existing.earlyLeaveMinutes = earlyLeaveMinutes;
      existing.workedMinutes = workedMinutes;
      return this.recordRepo.save(existing);
    }

    // No punch/manual/import row exists yet (e.g. a purely system-derived weekend/holiday/
    // on_leave/absent day) — create one so calendar views have a single source of truth.
    // `Manual` is the closest fit in the shared vocabulary for a non-punch-originated row.
    const created = this.recordRepo.create({
      employeeId,
      workDate,
      checkInAt: null,
      checkOutAt: null,
      source: AttendanceSource.Manual,
      status,
      lateMinutes,
      earlyLeaveMinutes,
      workedMinutes,
    });
    return this.recordRepo.save(created);
  }

  private async isWorkingWeekday(workDate: string): Promise<boolean> {
    const workingWeek = await this.getWorkingWeek();
    const jsDay = new Date(workDate).getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isoDay = jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon … 6=Sun
    return workingWeek.includes(isoDay);
  }

  private async getWorkingWeek(): Promise<number[]> {
    const setting = await this.settingRepo.findOne({ where: { key: 'working_week' } });
    if (!setting) return [0, 1, 2, 3, 4]; // default Mon-Fri
    return setting.value as number[];
  }

  private combine(workDate: string, time: string): Date {
    return new Date(`${workDate}T${time}`);
  }
}
