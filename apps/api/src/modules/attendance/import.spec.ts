import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ImportService } from './import.service';
import { ImportBatch } from '../../database/entities/attendance/import-batch.entity';
import { ImportRow } from '../../database/entities/attendance/import-row.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { AttendanceResolverService } from './attendance-resolver.service';
import { ImportBatchStatus, ImportRowStatus } from '@hrm/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BATCH_ID = 'batch-1';
const EMPLOYEE_MAIN = { id: 'emp-1', employeeCode: 'EMP-001', deviceUserId: '1001', firstName: 'Alex', lastName: 'Chen' };

function makeImportRow(overrides: Partial<ImportRow>): ImportRow {
  return {
    id: overrides.id ?? 'row-1',
    importBatchId: BATCH_ID,
    rowNumber: 2,
    raw: [],
    matchedEmployeeId: null,
    parsed: null,
    status: ImportRowStatus.Ok,
    message: null,
    createdAt: new Date(),
    ...overrides,
  } as ImportRow;
}

function makeRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    remove: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

async function buildService() {
  const batchRepo = makeRepo();
  batchRepo.findOne.mockResolvedValue({
    id: BATCH_ID,
    status: ImportBatchStatus.Validated,
    startedAt: null,
  });

  const rowRepo = makeRepo();
  const employeeRepo = makeRepo();
  const recordRepo = makeRepo();
  const resolver = { resolveDay: jest.fn().mockResolvedValue(undefined) };
  const dataSource = {
    transaction: jest.fn().mockImplementation(async (cb: (em: unknown) => unknown) => {
      const em = {
        upsert: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockImplementation((_entity: unknown, val: unknown) => Promise.resolve(val)),
        create: jest.fn().mockImplementation((_entity: unknown, val: unknown) => val),
        find: jest.fn().mockResolvedValue([]),
      };
      return cb(em);
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ImportService,
      { provide: getRepositoryToken(ImportBatch), useValue: batchRepo },
      { provide: getRepositoryToken(ImportRow), useValue: rowRepo },
      { provide: getRepositoryToken(AttendanceRecord), useValue: recordRepo },
      { provide: getRepositoryToken(Employee), useValue: employeeRepo },
      { provide: AttendanceResolverService, useValue: resolver },
      { provide: DataSource, useValue: dataSource },
    ],
  }).compile();

  return { svc: module.get(ImportService), rowRepo, employeeRepo, recordRepo, dataSource };
}

describe('ImportService.validate', () => {
  it('flags a row with no matching employee as an error', async () => {
    const { svc, rowRepo, employeeRepo } = await buildService();
    const rows = [makeImportRow({ parsed: { employeeCode: 'NOPE', workDate: '2026-07-06', checkInAt: new Date(), checkOutAt: new Date() } })];
    rowRepo.find.mockResolvedValue(rows);
    employeeRepo.findOne.mockResolvedValue(null);

    await svc.validate(BATCH_ID);

    expect(rows[0].status).toBe(ImportRowStatus.Error);
    expect(rows[0].message).toMatch(/No employee found/);
  });

  it('matches an employee by employee_code and marks the row ok', async () => {
    const { svc, rowRepo, employeeRepo, recordRepo } = await buildService();
    const rows = [makeImportRow({ parsed: { employeeCode: 'EMP-001', workDate: '2026-07-06', checkInAt: new Date(), checkOutAt: new Date() } })];
    rowRepo.find.mockResolvedValue(rows);
    employeeRepo.findOne.mockResolvedValue(EMPLOYEE_MAIN);
    recordRepo.findOne.mockResolvedValue(null);

    await svc.validate(BATCH_ID);

    expect(rows[0].status).toBe(ImportRowStatus.Ok);
    expect(rows[0].matchedEmployeeId).toBe(EMPLOYEE_MAIN.id);
  });

  it('falls back to device_user_id when employee_code is absent', async () => {
    const { svc, rowRepo, employeeRepo, recordRepo } = await buildService();
    const rows = [makeImportRow({ parsed: { deviceUserId: '1001', workDate: '2026-07-06', checkInAt: new Date(), checkOutAt: new Date() } })];
    rowRepo.find.mockResolvedValue(rows);
    employeeRepo.findOne.mockImplementation(({ where }: { where: Record<string, string> }) =>
      Promise.resolve(where.deviceUserId === '1001' ? EMPLOYEE_MAIN : null),
    );
    recordRepo.findOne.mockResolvedValue(null);

    await svc.validate(BATCH_ID);

    expect(rows[0].status).toBe(ImportRowStatus.Ok);
    expect(rows[0].matchedEmployeeId).toBe(EMPLOYEE_MAIN.id);
  });

  it('flags check-out before check-in as an error', async () => {
    const { svc, rowRepo, employeeRepo, recordRepo } = await buildService();
    const rows = [makeImportRow({
      parsed: {
        employeeCode: 'EMP-001',
        workDate: '2026-07-06',
        checkInAt: new Date('2026-07-06T17:00:00'),
        checkOutAt: new Date('2026-07-06T09:00:00'),
      },
    })];
    rowRepo.find.mockResolvedValue(rows);
    employeeRepo.findOne.mockResolvedValue(EMPLOYEE_MAIN);
    recordRepo.findOne.mockResolvedValue(null);

    await svc.validate(BATCH_ID);

    expect(rows[0].status).toBe(ImportRowStatus.Error);
    expect(rows[0].message).toMatch(/before check-in/);
  });

  it('flags the second of two rows for the same employee/date in one batch as a duplicate warning', async () => {
    const { svc, rowRepo, employeeRepo, recordRepo } = await buildService();
    const rows = [
      makeImportRow({ id: 'row-1', rowNumber: 2, parsed: { employeeCode: 'EMP-001', workDate: '2026-07-06', checkInAt: new Date(), checkOutAt: new Date() } }),
      makeImportRow({ id: 'row-2', rowNumber: 3, parsed: { employeeCode: 'EMP-001', workDate: '2026-07-06', checkInAt: new Date(), checkOutAt: new Date() } }),
    ];
    rowRepo.find.mockResolvedValue(rows);
    employeeRepo.findOne.mockResolvedValue(EMPLOYEE_MAIN);
    recordRepo.findOne.mockResolvedValue(null);

    await svc.validate(BATCH_ID);

    expect(rows[0].status).toBe(ImportRowStatus.Ok);
    expect(rows[1].status).toBe(ImportRowStatus.Warning);
    expect(rows[1].message).toMatch(/Duplicate/);
  });

  it('warns (not errors) when a cross-batch attendance record already exists for that employee/date', async () => {
    const { svc, rowRepo, employeeRepo, recordRepo } = await buildService();
    const rows = [makeImportRow({ parsed: { employeeCode: 'EMP-001', workDate: '2026-07-06', checkInAt: new Date(), checkOutAt: new Date() } })];
    rowRepo.find.mockResolvedValue(rows);
    employeeRepo.findOne.mockResolvedValue(EMPLOYEE_MAIN);
    recordRepo.findOne.mockResolvedValue({ id: 'rec-1', importBatchId: 'other-batch' });

    await svc.validate(BATCH_ID);

    expect(rows[0].status).toBe(ImportRowStatus.Warning);
    expect(rows[0].message).toMatch(/Will update/);
  });
});

describe('ImportService.commit', () => {
  it('upserts on (employeeId, workDate) so a re-import updates rather than duplicates', async () => {
    const { svc, rowRepo, dataSource } = await buildService();
    const firstPunch = {
      checkInAt: new Date('2026-07-06T09:00:00'),
      checkOutAt: new Date('2026-07-06T17:00:00'),
    };
    const row = makeImportRow({
      status: ImportRowStatus.Ok,
      matchedEmployeeId: EMPLOYEE_MAIN.id,
      parsed: { workDate: '2026-07-06', ...firstPunch },
    });
    rowRepo.find.mockResolvedValue([row]);

    await svc.commit(BATCH_ID, {});

    const firstCallback = (dataSource.transaction as jest.Mock).mock.calls[0][0];
    // Re-invoke with a fresh spy em to inspect the upsert call shape directly.
    const emFirst = { upsert: jest.fn().mockResolvedValue(undefined), update: jest.fn().mockResolvedValue(undefined) };
    await firstCallback(emFirst);

    expect(emFirst.upsert).toHaveBeenCalledWith(
      AttendanceRecord,
      expect.objectContaining({
        employeeId: EMPLOYEE_MAIN.id,
        workDate: '2026-07-06',
        checkInAt: firstPunch.checkInAt,
        checkOutAt: firstPunch.checkOutAt,
      }),
      { conflictPaths: ['employeeId', 'workDate'] },
    );

    // Simulate a corrected re-import of the same employee/day with different punch times —
    // the upsert payload must reflect the NEW times, which is what makes the conflict-path
    // upsert overwrite the existing row instead of leaving stale data behind.
    const secondPunch = {
      checkInAt: new Date('2026-07-06T09:30:00'),
      checkOutAt: new Date('2026-07-06T17:45:00'),
    };
    rowRepo.find.mockResolvedValue([
      makeImportRow({
        id: 'row-2',
        status: ImportRowStatus.Ok,
        matchedEmployeeId: EMPLOYEE_MAIN.id,
        parsed: { workDate: '2026-07-06', ...secondPunch },
      }),
    ]);

    await svc.commit(BATCH_ID, {});

    const secondCallback = (dataSource.transaction as jest.Mock).mock.calls[1][0];
    const emSecond = { upsert: jest.fn().mockResolvedValue(undefined), update: jest.fn().mockResolvedValue(undefined) };
    await secondCallback(emSecond);

    expect(emSecond.upsert).toHaveBeenCalledWith(
      AttendanceRecord,
      expect.objectContaining({
        employeeId: EMPLOYEE_MAIN.id,
        workDate: '2026-07-06',
        checkInAt: secondPunch.checkInAt,
        checkOutAt: secondPunch.checkOutAt,
      }),
      { conflictPaths: ['employeeId', 'workDate'] },
    );
  });
});

describe('ImportService — punch collapse (first-in/last-out)', () => {
  it('collapses multiple punch times into the earliest check-in and latest check-out', async () => {
    const { svc } = await buildService();
    // Access the private parser directly — it has no file-I/O dependency, only pure parsing.
    const parseRow = (svc as unknown as {
      parseRow: (raw: unknown[], idx: { employeeCodeIdx: number; deviceUserIdIdx: number; dateIdx: number; timeIdxs: number[] }) => {
        checkInAt: Date | null;
        checkOutAt: Date | null;
      };
    }).parseRow.bind(svc);

    const raw = ['EMP-001', '2026-07-06', '13:05:00', '09:02:00', '12:00:00', '17:45:00'];
    const parsed = parseRow(raw, { employeeCodeIdx: 0, deviceUserIdIdx: -1, dateIdx: 1, timeIdxs: [2, 3, 4, 5] });

    // Compare against the same local-time construction the parser uses, rather than
    // toISOString() (which would shift by the machine's UTC offset).
    expect(parsed.checkInAt?.getTime()).toBe(new Date('2026-07-06T09:02:00').getTime());
    expect(parsed.checkOutAt?.getTime()).toBe(new Date('2026-07-06T17:45:00').getTime());
  });
});
