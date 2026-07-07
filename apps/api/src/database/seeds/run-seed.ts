import 'reflect-metadata';
import { config } from 'dotenv';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { dataSourceOptions } from '../data-source';
import { Permission as P, RoleName, ApprovalEntityType, ApproverType } from '@hrm/types';

config({ path: join(__dirname, '../../../../../.env') });

const ROLE_PERMISSIONS: Record<string, string[]> = {
  [RoleName.Employee]: [
    P.EmployeeRead, P.AttendanceClockIn, P.AttendanceViewOwn, P.AttendanceRegularize,
    P.LeaveApply, P.RequisitionCreate, P.TravelCreate,
    P.ExpenseCreate, P.NotificationsRead,
  ],
  [RoleName.LineManager]: [
    P.EmployeeRead, P.EmployeeReadAll,
    P.AttendanceClockIn, P.AttendanceViewOwn, P.AttendanceViewAll, P.AttendanceRegularize,
    P.LeaveApply, P.LeaveApprove,
    P.RequisitionCreate, P.RequisitionApprove,
    P.TravelCreate, P.TravelApprove,
    P.ExpenseCreate, P.NotificationsRead,
  ],
  [RoleName.HRAdmin]: [
    P.EmployeeCreate, P.EmployeeRead, P.EmployeeUpdate, P.EmployeeDelete, P.EmployeeReadAll,
    P.DepartmentManage, P.DesignationManage,
    P.AttendanceClockIn, P.AttendanceViewOwn, P.AttendanceViewAll, P.AttendanceManual, P.AttendanceRegularize,
    P.AttendanceManageShift, P.AttendanceManageRoster, P.AttendanceManageHoliday,
    P.ImportUpload, P.ImportCommit,
    P.LeaveApply, P.LeaveApprove, P.LeaveManage,
    P.SalaryView, P.SalaryManage,
    P.RequisitionCreate, P.RequisitionApprove,
    P.TravelCreate, P.TravelApprove, P.TravelSettle, P.TravelReimburse,
    P.ExpenseCreate, P.ExpenseApprove,
    P.ReportsView, P.NotificationsRead, P.WorkflowConfigure, P.RoleManage,
  ],
  [RoleName.Finance]: [
    P.EmployeeRead, P.SalaryView,
    P.ExpenseApprove, P.ExpenseReimburse,
    P.TravelApprove, P.TravelSettle, P.TravelReimburse, P.ReportsView, P.ExportsFinance, P.NotificationsRead,
  ],
};

async function runSeed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();
  try {
    console.log('Running seeds…');

    // Settings
    const settingsRepo = dataSource.getRepository('settings');
    for (const s of [
      { key: 'org_name', value: 'Acme Corp' },
      { key: 'timezone', value: 'Asia/Dhaka' },
      { key: 'working_week', value: [0, 1, 2, 3, 4] },
      { key: 'currency', value: 'BDT' },
      { key: 'fiscal_year_start', value: '01-01' },
      { key: 'basic_to_gross_min_ratio', value: 0.5 },
      { key: 'allow_self_salary_view', value: false },
      { key: 'terminated_data_retention_days', value: 730 },
    ]) {
      await settingsRepo.createQueryBuilder().insert().into('settings')
        .values({ key: s.key, value: s.value }).orIgnore().execute();
    }

    // Permissions
    const permRepo = dataSource.getRepository('permissions');
    for (const key of Object.values(P)) {
      await permRepo.createQueryBuilder().insert().into('permissions')
        .values({ key, description: key }).orIgnore().execute();
    }

    // Roles
    const roleRepo = dataSource.getRepository('roles');
    for (const name of Object.values(RoleName)) {
      await roleRepo.createQueryBuilder().insert().into('roles')
        .values({ name, description: name }).orIgnore().execute();
    }

    // Role-permission links
    for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await roleRepo.findOne({ where: { name: roleName } });
      if (!role) continue;
      for (const key of permKeys) {
        const perm = await permRepo.findOne({ where: { key } });
        if (!perm) continue;
        await dataSource.createQueryBuilder().insert().into('role_permissions')
          .values({ role_id: role.id, permission_id: perm.id }).orIgnore().execute();
      }
    }

    // Super Admin gets ALL permissions
    const superRole = await roleRepo.findOne({ where: { name: RoleName.SuperAdmin } });
    if (superRole) {
      for (const perm of await permRepo.find()) {
        await dataSource.createQueryBuilder().insert().into('role_permissions')
          .values({ role_id: superRole.id, permission_id: perm.id }).orIgnore().execute();
      }
    }

    // Super admin user
    const userRepo = dataSource.getRepository('users');
    if (!(await userRepo.findOne({ where: { email: 'admin@hrm.local' } })) && superRole) {
      const passwordHash = await argon2.hash('123456');
      const admin = userRepo.create({ email: 'admin@hrm.local', passwordHash, status: 'active' });
      const saved = await userRepo.save(admin);
      await dataSource.createQueryBuilder().insert().into('user_roles')
        .values({ user_id: saved.id, role_id: superRole.id }).orIgnore().execute();
      console.log('Super admin created: admin@hrm.local / 123456');
    }

    // Default approval workflows
    const hrAdminRole = await roleRepo.findOne({ where: { name: RoleName.HRAdmin } });
    const financeRole = await roleRepo.findOne({ where: { name: RoleName.Finance } });

    type WfStep = {
      stepOrder: number;
      approverType: string;
      approverRef: string | null;
      isMandatory: boolean;
      slaHours: number | null;
      minMetricValue?: number | null;
      maxMetricValue?: number | null;
    };
    type WfDef = { name: string; entityType: string; steps: WfStep[] };

    const defaultWorkflows: WfDef[] = [
      {
        // Mirrors a real escalation chain: direct manager always approves; 4+ days also
        // needs the skip-level manager; 8+ days escalates to three levels up — all resolved
        // dynamically off the requester's reporting chain, not a fixed named role.
        name: 'Leave Approval',
        entityType: ApprovalEntityType.Leave,
        steps: [
          { stepOrder: 1, approverType: ApproverType.ManagerChainLevel, approverRef: '1', isMandatory: true, slaHours: 24 },
          { stepOrder: 2, approverType: ApproverType.ManagerChainLevel, approverRef: '2', isMandatory: true, slaHours: 24, minMetricValue: 4 },
          { stepOrder: 3, approverType: ApproverType.ManagerChainLevel, approverRef: '3', isMandatory: true, slaHours: 24, minMetricValue: 8 },
        ],
      },
      {
        name: 'Requisition Approval',
        entityType: ApprovalEntityType.Requisition,
        steps: [
          { stepOrder: 1, approverType: ApproverType.LineManager, approverRef: null, isMandatory: true, slaHours: 24 },
          { stepOrder: 2, approverType: ApproverType.Role, approverRef: hrAdminRole?.id ?? null, isMandatory: true, slaHours: 48 },
        ],
      },
      {
        name: 'Travel Request Approval',
        entityType: ApprovalEntityType.TravelRequest,
        steps: [
          { stepOrder: 1, approverType: ApproverType.LineManager, approverRef: null, isMandatory: true, slaHours: 24 },
        ],
      },
      {
        name: 'Expense Claim Approval',
        entityType: ApprovalEntityType.ExpenseClaim,
        steps: [
          { stepOrder: 1, approverType: ApproverType.LineManager, approverRef: null, isMandatory: true, slaHours: 24 },
          { stepOrder: 2, approverType: ApproverType.Role, approverRef: financeRole?.id ?? null, isMandatory: true, slaHours: 48 },
        ],
      },
      {
        // Post-trip reconciliation of actual vs. advanced cost — separate from the pre-trip
        // request's workflow so it can be routed straight to Finance without re-involving
        // the line manager.
        name: 'Travel Settlement Approval',
        entityType: ApprovalEntityType.TravelSettlement,
        steps: [
          { stepOrder: 1, approverType: ApproverType.Role, approverRef: financeRole?.id ?? null, isMandatory: true, slaHours: 48 },
        ],
      },
      {
        name: 'Regularization Approval',
        entityType: ApprovalEntityType.Regularization,
        steps: [
          { stepOrder: 1, approverType: ApproverType.LineManager, approverRef: null, isMandatory: true, slaHours: 24 },
        ],
      },
    ];

    for (const wf of defaultWorkflows) {
      const existing = await dataSource.query(
        `SELECT id FROM workflows WHERE entity_type = $1 AND is_active = true LIMIT 1`,
        [wf.entityType],
      );
      if (existing.length > 0) continue;

      const inserted = await dataSource.query(
        `INSERT INTO workflows (name, entity_type, is_active) VALUES ($1, $2, true) RETURNING id`,
        [wf.name, wf.entityType],
      );
      const workflowId: string = inserted[0]?.id;
      if (!workflowId) continue;

      for (const step of wf.steps) {
        await dataSource.query(
          `INSERT INTO workflow_steps
             (workflow_id, step_order, approver_type, approver_ref, is_mandatory, sla_hours, min_metric_value, max_metric_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            workflowId, step.stepOrder, step.approverType, step.approverRef, step.isMandatory, step.slaHours,
            step.minMetricValue ?? null, step.maxMetricValue ?? null,
          ],
        );
      }
    }
    console.log('Default workflows seeded.');

    // Default leave types
    const defaultLeaveTypes = [
      { name: 'Sick Leave',       code: 'SICK',    isPaid: true,  requiresDocument: false, accrualMethod: 'monthly', defaultDaysPerYear: 12, maxCarryForward: 0,  allowNegativeBalance: false, color: '#C26D6D' },
      { name: 'Casual Leave',     code: 'CASUAL',  isPaid: true,  requiresDocument: false, accrualMethod: 'yearly',  defaultDaysPerYear: 10, maxCarryForward: 5,  allowNegativeBalance: false, color: '#6B8CCF' },
      { name: 'Earned Leave',     code: 'EARNED',  isPaid: true,  requiresDocument: false, accrualMethod: 'monthly', defaultDaysPerYear: 18, maxCarryForward: 30, allowNegativeBalance: false, color: '#4C9A77' },
      { name: 'Maternity Leave',  code: 'MAT',     isPaid: true,  requiresDocument: true,  accrualMethod: 'none',    defaultDaysPerYear: 90, maxCarryForward: 0,  allowNegativeBalance: false, color: '#D6A14A' },
      { name: 'Unpaid Leave',     code: 'UNPAID',  isPaid: false, requiresDocument: false, accrualMethod: 'none',    defaultDaysPerYear: 0,  maxCarryForward: 0,  allowNegativeBalance: true,  color: '#5C6B76' },
    ];
    for (const lt of defaultLeaveTypes) {
      const exists = await dataSource.query(
        `SELECT id FROM leave_types WHERE code = $1 LIMIT 1`,
        [lt.code],
      );
      if (exists.length > 0) continue;
      await dataSource.query(
        `INSERT INTO leave_types (name, code, is_paid, requires_document, accrual_method, default_days_per_year, max_carry_forward, allow_negative_balance, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [lt.name, lt.code, lt.isPaid, lt.requiresDocument, lt.accrualMethod, lt.defaultDaysPerYear, lt.maxCarryForward, lt.allowNegativeBalance, lt.color],
      );
    }
    console.log('Default leave types seeded.');

    // ── Demo org: department, designation, manager + report ─────────────────────
    // No employee data exists yet in this seed script (Phase 2 shipped the module
    // but not demo rows) — attendance/roster/schedule seeds below need real
    // employees to reference, so create a minimal demo pair here.
    let deptId: string | null = null;
    {
      const existing = await dataSource.query(`SELECT id FROM departments WHERE code = 'GEN' LIMIT 1`);
      if (existing.length > 0) {
        deptId = existing[0].id;
      } else {
        const inserted = await dataSource.query(
          `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
          ['General', 'GEN'],
        );
        deptId = inserted[0]?.id ?? null;
      }
    }

    let designationId: string | null = null;
    {
      const existing = await dataSource.query(`SELECT id FROM designations WHERE title = 'Staff' LIMIT 1`);
      if (existing.length > 0) {
        designationId = existing[0].id;
      } else {
        const inserted = await dataSource.query(
          `INSERT INTO designations (title, level) VALUES ($1, $2) RETURNING id`,
          ['Staff', 1],
        );
        designationId = inserted[0]?.id ?? null;
      }
    }

    const managerRole = await roleRepo.findOne({ where: { name: RoleName.LineManager } });
    const employeeRole = await roleRepo.findOne({ where: { name: RoleName.Employee } });
    const financeRoleForDemo = await roleRepo.findOne({ where: { name: RoleName.Finance } });
    const demoPasswordHash = await argon2.hash('123456');

    async function ensureDemoEmployee(
      email: string,
      employeeCode: string,
      deviceUserId: string,
      firstName: string,
      lastName: string,
      lineManagerId: string | null,
      roleId: string | undefined,
    ): Promise<string | null> {
      const existingEmp = await dataSource.query(
        `SELECT id, user_id FROM employees WHERE employee_code = $1 LIMIT 1`,
        [employeeCode],
      );
      if (existingEmp.length > 0) {
        const empId = existingEmp[0].id;
        // Self-heal on re-seed: this function is idempotent-by-code, but earlier it
        // short-circuited without updating existing rows — so a DB seeded under an
        // older manager-chain shape kept a stale line_manager_id, silently breaking
        // manager-chain approval routing (the demo employee reported to the wrong
        // person). Re-point the linkage and re-ensure the role on every run.
        await dataSource.query(
          `UPDATE employees SET line_manager_id = $1 WHERE id = $2`,
          [lineManagerId, empId],
        );
        if (roleId && existingEmp[0].user_id) {
          await dataSource.createQueryBuilder().insert().into('user_roles')
            .values({ user_id: existingEmp[0].user_id, role_id: roleId }).orIgnore().execute();
        }
        return empId;
      }

      let userId: string;
      const existingUser = await dataSource.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      } else {
        const insertedUser = await dataSource.query(
          `INSERT INTO users (email, password_hash, status) VALUES ($1, $2, 'active') RETURNING id`,
          [email, demoPasswordHash],
        );
        userId = insertedUser[0].id;
        if (roleId) {
          await dataSource.createQueryBuilder().insert().into('user_roles')
            .values({ user_id: userId, role_id: roleId }).orIgnore().execute();
        }
      }

      const insertedEmp = await dataSource.query(
        `INSERT INTO employees (
           user_id, employee_code, device_user_id, first_name, last_name, join_date,
           employment_type, department_id, designation_id, line_manager_id
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'permanent', $6, $7, $8)
         RETURNING id`,
        [userId, employeeCode, deviceUserId, firstName, lastName, deptId, designationId, lineManagerId],
      );
      return insertedEmp[0]?.id ?? null;
    }

    // Three levels above the demo employee so the leave workflow's manager-chain escalation
    // (skip-level for 4+ days, skip-skip-level for 8+ days) is fully demonstrable/testable.
    const vpId = await ensureDemoEmployee(
      'vp@hrm.local', 'EMP-VP-001', '1000', 'Taylor', 'Brooks', null, managerRole?.id,
    );
    const headId = await ensureDemoEmployee(
      'head@hrm.local', 'EMP-HOT-001', '1000b', 'Jordan', 'Hale', vpId, managerRole?.id,
    );
    const managerId = await ensureDemoEmployee(
      'manager@hrm.local', 'EMP-MGR-001', '1001', 'Morgan', 'Reyes', headId, managerRole?.id,
    );
    const employeeId = await ensureDemoEmployee(
      'employee@hrm.local', 'EMP-001', '1002', 'Alex', 'Chen', managerId, employeeRole?.id,
    );
    // Without a seeded Finance-role holder, every Finance-routed approval step (expense
    // claim step 2, travel settlement) has no resolvable approver and silently auto-skips —
    // so this account is required for those flows to be demonstrable/testable at all.
    await ensureDemoEmployee(
      'finance@hrm.local', 'EMP-FIN-001', '1003', 'Riley', 'Kaur', null, financeRoleForDemo?.id,
    );
    // One login per role (§5) so every role can be exercised end to end.
    await ensureDemoEmployee(
      'hradmin@hrm.local', 'EMP-HR-001', '1004', 'Sam', 'Rivera', null, hrAdminRole?.id,
    );
    console.log('Demo department, designation, manager chain (VP > Head > Manager) and report employee seeded.');

    // ── Attendance: holidays, shifts, schedules, roster, attendance records ─────
    const todayForSeed = new Date();
    const mondayThisWeek = new Date(todayForSeed);
    mondayThisWeek.setDate(todayForSeed.getDate() - ((todayForSeed.getDay() + 6) % 7)); // back up to Monday
    const dateStr = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, n: number) => {
      const copy = new Date(d);
      copy.setDate(copy.getDate() + n);
      return copy;
    };

    // Holidays
    const demoHolidays = [
      { name: 'Independence Day', date: dateStr(addDays(todayForSeed, 10)), type: 'government', isRecurring: true },
      { name: 'Founders Day', date: dateStr(addDays(todayForSeed, 20)), type: 'company', isRecurring: false },
    ];
    for (const h of demoHolidays) {
      const exists = await dataSource.query(`SELECT id FROM holidays WHERE name = $1 AND date = $2 LIMIT 1`, [h.name, h.date]);
      if (exists.length > 0) continue;
      await dataSource.query(
        `INSERT INTO holidays (name, date, type, is_recurring) VALUES ($1, $2, $3, $4)`,
        [h.name, h.date, h.type, h.isRecurring],
      );
    }
    console.log('Demo holidays seeded.');

    // Shifts
    async function ensureShift(name: string, type: string, startTime: string, endTime: string, graceMinutes: number, halfDayThresholdMinutes: number, workingHours: number): Promise<string | null> {
      const exists = await dataSource.query(`SELECT id FROM shifts WHERE name = $1 LIMIT 1`, [name]);
      if (exists.length > 0) return exists[0].id;
      const inserted = await dataSource.query(
        `INSERT INTO shifts (name, type, start_time, end_time, grace_minutes, half_day_threshold_minutes, working_hours)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [name, type, startTime, endTime, graceMinutes, halfDayThresholdMinutes, workingHours],
      );
      return inserted[0]?.id ?? null;
    }

    const generalShiftId = await ensureShift('General Shift', 'fixed', '09:00:00', '17:00:00', 15, 240, 8);
    const eveningShiftId = await ensureShift('Evening Shift', 'roster', '14:00:00', '22:00:00', 15, 240, 8);
    console.log('Demo shifts seeded.');

    // Schedules for the current week (Mon-Fri General Shift, Sat/Sun weekend) for both demo employees
    if (managerId && employeeId && generalShiftId) {
      for (const empId of [managerId, employeeId]) {
        for (let i = 0; i < 7; i++) {
          const day = addDays(mondayThisWeek, i);
          const workDate = dateStr(day);
          const isWeekend = i >= 5;
          const exists = await dataSource.query(
            `SELECT id FROM schedules WHERE employee_id = $1 AND work_date = $2 LIMIT 1`,
            [empId, workDate],
          );
          if (exists.length > 0) continue;
          await dataSource.query(
            `INSERT INTO schedules (employee_id, shift_id, work_date, is_weekend, is_holiday)
             VALUES ($1, $2, $3, $4, false)`,
            [empId, isWeekend ? null : generalShiftId, workDate, isWeekend],
          );
        }
      }
      console.log('Demo schedules seeded.');
    }

    // Roster + roster_assignments covering the demo team for the current week
    if (deptId && managerId && employeeId && generalShiftId && eveningShiftId) {
      let rosterId: string | null = null;
      const existingRoster = await dataSource.query(`SELECT id FROM rosters WHERE name = 'Support Rotation' LIMIT 1`);
      if (existingRoster.length > 0) {
        rosterId = existingRoster[0].id;
      } else {
        const inserted = await dataSource.query(
          `INSERT INTO rosters (name, department_id, cycle_days) VALUES ($1, $2, 7) RETURNING id`,
          ['Support Rotation', deptId],
        );
        rosterId = inserted[0]?.id ?? null;
      }

      if (rosterId) {
        for (let i = 0; i < 5; i++) {
          const workDate = dateStr(addDays(mondayThisWeek, i));
          // Alternate: manager on General, report on Evening — demonstrates per-day shift variety
          const assignments: Array<[string, string]> = [
            [managerId, generalShiftId],
            [employeeId, eveningShiftId],
          ];
          for (const [empId, shiftId] of assignments) {
            const exists = await dataSource.query(
              `SELECT id FROM roster_assignments WHERE roster_id = $1 AND employee_id = $2 AND work_date = $3 LIMIT 1`,
              [rosterId, empId, workDate],
            );
            if (exists.length > 0) continue;
            await dataSource.query(
              `INSERT INTO roster_assignments (roster_id, employee_id, shift_id, work_date) VALUES ($1, $2, $3, $4)`,
              [rosterId, empId, shiftId, workDate],
            );
          }
        }
        console.log('Demo roster and assignments seeded.');
      }
    }

    // Attendance records: present, late, half-day — for the past few settled days (not today)
    if (employeeId && generalShiftId) {
      const yesterday = addDays(todayForSeed, -1);
      const twoDaysAgo = addDays(todayForSeed, -2);
      const threeDaysAgo = addDays(todayForSeed, -3);

      const demoRecords = [
        // On-time: in at 08:55, out at 17:05 -> present
        { workDate: dateStr(yesterday), checkIn: '08:55:00', checkOut: '17:05:00', status: 'present', lateMinutes: 0, workedMinutes: 490 },
        // Late: in at 09:25 (grace is 15 min past 09:00) -> late by 10 min
        { workDate: dateStr(twoDaysAgo), checkIn: '09:25:00', checkOut: '17:00:00', status: 'late', lateMinutes: 10, workedMinutes: 455 },
        // Half day: only worked 3 hours
        { workDate: dateStr(threeDaysAgo), checkIn: '09:00:00', checkOut: '12:00:00', status: 'half_day', lateMinutes: 0, workedMinutes: 180 },
      ];

      for (const r of demoRecords) {
        const exists = await dataSource.query(
          `SELECT id FROM attendance_records WHERE employee_id = $1 AND work_date = $2 LIMIT 1`,
          [employeeId, r.workDate],
        );
        if (exists.length > 0) continue;
        await dataSource.query(
          `INSERT INTO attendance_records (
             employee_id, work_date, check_in_at, check_out_at, source, status, late_minutes, worked_minutes
           ) VALUES ($1, $2, $3, $4, 'web', $5, $6, $7)`,
          [
            employeeId,
            r.workDate,
            `${r.workDate}T${r.checkIn}`,
            `${r.workDate}T${r.checkOut}`,
            r.status,
            r.lateMinutes,
            r.workedMinutes,
          ],
        );
      }
      // Four days ago: intentionally no record, so the resolver's Absent branch
      // is exercised on read for a scheduled working day with no punch.
      console.log('Demo attendance records seeded (present, late, half-day; one day left absent by omission).');
    }

    // Approved leave application overlapping a schedule day — exercises "approved leave auto-marks the day"
    if (managerId) {
      const leaveType = await dataSource.query(`SELECT id FROM leave_types WHERE code = 'CASUAL' LIMIT 1`);
      const leaveTypeId = leaveType[0]?.id;
      if (leaveTypeId) {
        const leaveDate = dateStr(addDays(mondayThisWeek, 2)); // a mid-week day this week
        const exists = await dataSource.query(
          `SELECT id FROM leave_applications WHERE employee_id = $1 AND start_date = $2 LIMIT 1`,
          [managerId, leaveDate],
        );
        if (exists.length === 0) {
          await dataSource.query(
            `INSERT INTO leave_applications (employee_id, leave_type_id, start_date, end_date, days_count, is_half_day, status)
             VALUES ($1, $2, $3, $3, 1, false, 'approved')`,
            [managerId, leaveTypeId, leaveDate],
          );
          console.log('Demo approved leave application seeded.');
        }
      }
    }

    // Requisition mid-approval — exercises "asset requisition with items routes through
    // its approval chain", pending at step 1 (manager) so it shows up in Morgan's My Approvals.
    if (employeeId) {
      const exists = await dataSource.query(
        `SELECT id FROM requisitions WHERE requester_id = $1 AND title = $2 LIMIT 1`,
        [employeeId, 'New laptop for development work'],
      );
      if (exists.length === 0) {
        const workflow = await dataSource.query(
          `SELECT id FROM workflows WHERE entity_type = 'requisition' AND is_active = true LIMIT 1`,
        );
        const workflowId = workflow[0]?.id;
        const requesterUser = await dataSource.query(`SELECT user_id FROM employees WHERE id = $1`, [employeeId]);
        const requesterUserId = requesterUser[0]?.user_id;
        if (workflowId && requesterUserId) {
          const insertedReq = await dataSource.query(
            `INSERT INTO requisitions (requester_id, type, title, description, priority, estimated_cost, status)
             VALUES ($1, 'asset', $2, $3, 'high', 1350.00, 'pending') RETURNING id`,
            [employeeId, 'New laptop for development work', 'Current machine is out of warranty and struggling to run the toolchain.'],
          );
          const requisitionId = insertedReq[0]?.id;

          await dataSource.query(
            `INSERT INTO requisition_items (requisition_id, name, quantity, unit_cost, note)
             VALUES ($1, 'Laptop', 1, 1200.00, '16GB RAM, 512GB SSD'), ($1, 'Docking station', 1, 150.00, NULL)`,
            [requisitionId],
          );

          const insertedApproval = await dataSource.query(
            `INSERT INTO approvals (workflow_id, entity_type, entity_id, current_step, status, requested_by)
             VALUES ($1, 'requisition', $2, 1, 'pending', $3) RETURNING id`,
            [workflowId, requisitionId, requesterUserId],
          );
          await dataSource.query(
            `UPDATE requisitions SET approval_id = $1 WHERE id = $2`,
            [insertedApproval[0]?.id, requisitionId],
          );
          console.log('Demo requisition (pending manager approval) seeded.');
        }
      }
    }

    // Travel request + expense claim, both mid-approval — exercises "pre-trip approval"
    // and "expense claim with receipts routes through approval" for Alex Chen.
    if (employeeId) {
      const requesterUser = await dataSource.query(`SELECT user_id FROM employees WHERE id = $1`, [employeeId]);
      const requesterUserId = requesterUser[0]?.user_id;

      let travelRequestId: string | null = null;
      if (requesterUserId) {
        const existingTravel = await dataSource.query(
          `SELECT id FROM travel_requests WHERE employee_id = $1 AND purpose = $2 LIMIT 1`,
          [employeeId, 'Client onboarding visit'],
        );
        if (existingTravel.length > 0) {
          travelRequestId = existingTravel[0].id;
        } else {
          const travelWorkflow = await dataSource.query(
            `SELECT id FROM workflows WHERE entity_type = 'travel_request' AND is_active = true LIMIT 1`,
          );
          const travelWorkflowId = travelWorkflow[0]?.id;
          if (travelWorkflowId) {
            const tripDate = dateStr(addDays(todayForSeed, 14));
            const insertedTravel = await dataSource.query(
              `INSERT INTO travel_requests (employee_id, purpose, from_date, to_date, estimated_cost, advance_requested, status)
               VALUES ($1, 'Client onboarding visit', $2, $2, 300.00, 100.00, 'pending') RETURNING id`,
              [employeeId, tripDate],
            );
            travelRequestId = insertedTravel[0]?.id;

            await dataSource.query(
              `INSERT INTO travel_request_items
                 (travel_request_id, description, category, transport_mode, from_location, to_location, travel_date_from, travel_date_to, estimated_cost)
               VALUES ($1, 'Bus fare to Chittagong', 'travel', 'bus', 'Dhaka', 'Chittagong', $2, $2, 300.00)`,
              [travelRequestId, tripDate],
            );

            const insertedTravelApproval = await dataSource.query(
              `INSERT INTO approvals (workflow_id, entity_type, entity_id, current_step, status, requested_by)
               VALUES ($1, 'travel_request', $2, 1, 'pending', $3) RETURNING id`,
              [travelWorkflowId, travelRequestId, requesterUserId],
            );
            await dataSource.query(`UPDATE travel_requests SET approval_id = $1 WHERE id = $2`, [insertedTravelApproval[0]?.id, travelRequestId]);
            console.log('Demo travel request (pending manager approval) seeded.');
          }
        }
      }

      const existingExpense = await dataSource.query(
        `SELECT id FROM expense_claims WHERE employee_id = $1 AND title = $2 LIMIT 1`,
        [employeeId, 'Client visit expenses'],
      );
      if (existingExpense.length === 0 && requesterUserId) {
        const expenseWorkflow = await dataSource.query(
          `SELECT id FROM workflows WHERE entity_type = 'expense_claim' AND is_active = true LIMIT 1`,
        );
        const expenseWorkflowId = expenseWorkflow[0]?.id;
        if (expenseWorkflowId) {
          const insertedClaim = await dataSource.query(
            `INSERT INTO expense_claims (employee_id, travel_request_id, title, total_amount, currency, status)
             VALUES ($1, $2, 'Client visit expenses', 190.00, 'BDT', 'pending') RETURNING id`,
            [employeeId, travelRequestId],
          );
          const claimId = insertedClaim[0]?.id;

          const insertedExpenseItems = await dataSource.query(
            `INSERT INTO expense_items (expense_claim_id, description, amount, spent_on)
             VALUES ($1, 'Bus fare (round trip)', 150.00, CURRENT_DATE), ($1, 'Client lunch meeting', 40.00, CURRENT_DATE)
             RETURNING id`,
            [claimId],
          );
          const busFareItemId = insertedExpenseItems[0]?.id;

          const insertedExpenseApproval = await dataSource.query(
            `INSERT INTO approvals (workflow_id, entity_type, entity_id, current_step, status, requested_by)
             VALUES ($1, 'expense_claim', $2, 1, 'pending', $3) RETURNING id`,
            [expenseWorkflowId, claimId, requesterUserId],
          );
          await dataSource.query(`UPDATE expense_claims SET approval_id = $1 WHERE id = $2`, [insertedExpenseApproval[0]?.id, claimId]);
          console.log('Demo expense claim (pending manager approval) seeded.');

          // A demo receipt attachment on the bus fare line, so the attachment list/thumbnail
          // UI has something real to render out of the box.
          if (busFareItemId) {
            const attachmentsDir = join(process.cwd(), 'uploads', 'attachments');
            mkdirSync(attachmentsDir, { recursive: true });
            const placeholderPng = Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
              'base64',
            );
            const demoFileName = 'demo-seed-receipt.png';
            writeFileSync(join(attachmentsDir, demoFileName), placeholderPng);

            const existingAttachment = await dataSource.query(
              `SELECT id FROM attachments WHERE owner_type = 'expense_item' AND owner_id = $1 LIMIT 1`,
              [busFareItemId],
            );
            if (existingAttachment.length === 0) {
              await dataSource.query(
                `INSERT INTO attachments (owner_type, owner_id, file_url, file_name, mime_type, file_size_bytes, uploaded_by)
                 VALUES ('expense_item', $1, $2, 'bus-fare-receipt.png', 'image/png', $3, $4)`,
                [busFareItemId, `uploads/attachments/${demoFileName}`, placeholderPng.length, requesterUserId],
              );
            }
            console.log('Demo receipt attachment seeded.');
          }
        }
      }

      // A second trip, already approved and with a post-trip settlement submitted (pending
      // Finance) — exercises the estimate-vs-actual reconciliation flow without disturbing
      // the first trip's "pending manager approval" demo above.
      if (requesterUserId) {
        const existingRoadshow = await dataSource.query(
          `SELECT id FROM travel_requests WHERE employee_id = $1 AND purpose = $2 LIMIT 1`,
          [employeeId, 'Sylhet expansion review'],
        );
        if (existingRoadshow.length === 0) {
          const travelWorkflow = await dataSource.query(
            `SELECT id FROM workflows WHERE entity_type = 'travel_request' AND is_active = true LIMIT 1`,
          );
          const settlementWorkflow = await dataSource.query(
            `SELECT id FROM workflows WHERE entity_type = 'travel_settlement' AND is_active = true LIMIT 1`,
          );
          const travelWorkflowId = travelWorkflow[0]?.id;
          const settlementWorkflowId = settlementWorkflow[0]?.id;

          if (travelWorkflowId && settlementWorkflowId) {
            const fromDate = dateStr(addDays(todayForSeed, -10));
            const toDate = dateStr(addDays(todayForSeed, -7));

            const insertedRoadshow = await dataSource.query(
              `INSERT INTO travel_requests
                 (employee_id, purpose, from_date, to_date, estimated_cost, advance_requested,
                  approved_advance_amount, status, settlement_status, actual_cost, net_adjustment)
               VALUES ($1, 'Sylhet expansion review', $2, $3, 750.00, 750.00, 750.00, 'approved', 'pending', 900.00, 150.00)
               RETURNING id`,
              [employeeId, fromDate, toDate],
            );
            const roadshowId = insertedRoadshow[0]?.id;

            await dataSource.query(
              `INSERT INTO travel_request_items
                 (travel_request_id, description, category, transport_mode, from_location, to_location, is_round_trip, travel_date_from, travel_date_to, estimated_cost, actual_cost)
               VALUES
                 ($1, 'Bus fare to Sylhet', 'travel', 'bus', 'Dhaka', 'Sylhet', true, $2, $2, 500.00, 650.00),
                 ($1, 'Hotel stay in Sylhet', 'lodging', NULL, NULL, NULL, false, $2, $3, 250.00, 250.00)`,
              [roadshowId, fromDate, toDate],
            );

            const roadshowApproval = await dataSource.query(
              `INSERT INTO approvals (workflow_id, entity_type, entity_id, current_step, status, requested_by, metric_value, approved_amount)
               VALUES ($1, 'travel_request', $2, 1, 'approved', $3, 750.00, 750.00) RETURNING id`,
              [travelWorkflowId, roadshowId, requesterUserId],
            );
            await dataSource.query(`UPDATE travel_requests SET approval_id = $1 WHERE id = $2`, [roadshowApproval[0]?.id, roadshowId]);

            await dataSource.query(
              `INSERT INTO approvals (workflow_id, entity_type, entity_id, current_step, status, requested_by, metric_value)
               VALUES ($1, 'travel_settlement', $2, 1, 'pending', $3, 900.00)`,
              [settlementWorkflowId, roadshowId, requesterUserId],
            );
            console.log('Demo travel settlement (pending Finance approval) seeded.');
          }
        }
      }

      // A post-trip request — the employee already traveled and paid out of pocket, no
      // advance was ever requested. Approved and sitting in the Finance reimbursement
      // queue, exercising the post-trip flow end to end.
      if (requesterUserId) {
        const existingPostTrip = await dataSource.query(
          `SELECT id FROM travel_requests WHERE employee_id = $1 AND purpose = $2 LIMIT 1`,
          [employeeId, 'Client site visit (unplanned)'],
        );
        if (existingPostTrip.length === 0) {
          const travelWorkflow = await dataSource.query(
            `SELECT id FROM workflows WHERE entity_type = 'travel_request' AND is_active = true LIMIT 1`,
          );
          const travelWorkflowId = travelWorkflow[0]?.id;

          if (travelWorkflowId) {
            const fromDate = dateStr(addDays(todayForSeed, -4));
            const toDate = dateStr(addDays(todayForSeed, -3));

            const insertedPostTrip = await dataSource.query(
              `INSERT INTO travel_requests
                 (employee_id, purpose, timing, from_date, to_date, estimated_cost, advance_requested,
                  approved_advance_amount, status)
               VALUES ($1, 'Client site visit (unplanned)', 'post_trip', $2, $3, 180.00, 0, 180.00, 'approved')
               RETURNING id`,
              [employeeId, fromDate, toDate],
            );
            const postTripId = insertedPostTrip[0]?.id;

            await dataSource.query(
              `INSERT INTO travel_request_items
                 (travel_request_id, description, category, transport_mode, from_location, to_location, is_round_trip, travel_date_from, travel_date_to, estimated_cost)
               VALUES
                 ($1, 'CNG fare to client site', 'travel', 'other', 'Office', 'Client site', true, $2, $2, 30.00),
                 ($1, 'Lunch with client', 'meals', NULL, NULL, NULL, false, $2, $3, 150.00)`,
              [postTripId, fromDate, toDate],
            );

            const postTripApproval = await dataSource.query(
              `INSERT INTO approvals (workflow_id, entity_type, entity_id, current_step, status, requested_by, metric_value, approved_amount)
               VALUES ($1, 'travel_request', $2, 1, 'approved', $3, 180.00, 180.00) RETURNING id`,
              [travelWorkflowId, postTripId, requesterUserId],
            );
            await dataSource.query(`UPDATE travel_requests SET approval_id = $1 WHERE id = $2`, [postTripApproval[0]?.id, postTripId]);
            console.log('Demo post-trip travel request (approved, awaiting reimbursement) seeded.');
          }
        }
      }
    }

    // Documents, education, and previous-employment history for Alex Chen — exercises the
    // employee-profile Documents/Education/Work History tabs with real data out of the box.
    // Deliberately leave Alex Chen with no probation record and no job-change history so the
    // profile's "Start probation" / "Record promotion or transfer" empty states are also real.
    if (employeeId) {
      const existingDoc = await dataSource.query(
        `SELECT id FROM documents WHERE employee_id = $1 AND type = 'NID' LIMIT 1`,
        [employeeId],
      );
      if (existingDoc.length === 0) {
        const documentsDir = join(process.cwd(), 'uploads', 'documents');
        mkdirSync(documentsDir, { recursive: true });
        const placeholderPng = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        );
        const demoDocFileName = 'demo-seed-nid.png';
        writeFileSync(join(documentsDir, demoDocFileName), placeholderPng);

        await dataSource.query(
          `INSERT INTO documents (employee_id, type, file_url, file_name, mime_type, file_size_bytes, expiry_date)
           VALUES ($1, 'NID', $2, 'national-id.png', 'image/png', $3, NULL)`,
          [employeeId, `uploads/documents/${demoDocFileName}`, placeholderPng.length],
        );
        console.log('Demo document seeded.');
      }

      const existingEdu = await dataSource.query(`SELECT id FROM education WHERE employee_id = $1 LIMIT 1`, [employeeId]);
      if (existingEdu.length === 0) {
        await dataSource.query(
          `INSERT INTO education (employee_id, degree, institution, field_of_study, result, start_year, end_year)
           VALUES
             ($1, 'bachelors', 'University of Dhaka', 'Computer Science', '3.8 GPA', 2016, 2020),
             ($1, 'hsc', 'Notre Dame College', 'Science', 'GPA 5.00', 2014, 2016)`,
          [employeeId],
        );
        console.log('Demo education records seeded.');
      }

      const existingPrev = await dataSource.query(
        `SELECT id FROM previous_employments WHERE employee_id = $1 LIMIT 1`,
        [employeeId],
      );
      if (existingPrev.length === 0) {
        await dataSource.query(
          `INSERT INTO previous_employments (employee_id, company_name, designation, from_date, to_date, reason_for_leaving)
           VALUES ($1, 'BrightSoft Ltd.', 'Junior Software Engineer', '2020-07-01', '2023-12-31', 'Career growth opportunity')`,
          [employeeId],
        );
        console.log('Demo previous employment record seeded.');
      }
    }

    console.log('Seeds complete.');
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
