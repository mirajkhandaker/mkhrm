import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';
import {
  AttendanceSource,
  AttendanceStatus,
  ImportBatchStatus,
  ImportRowStatus,
  ImportType,
} from '@hrm/types';
import { ImportBatch } from '../../database/entities/attendance/import-batch.entity';
import { ImportRow } from '../../database/entities/attendance/import-row.entity';
import { AttendanceRecord } from '../../database/entities/attendance/attendance-record.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { AttendanceResolverService } from './attendance-resolver.service';
import { ColumnMappingDto } from './dto/column-mapping.dto';
import { CommitImportDto } from './dto/commit-import.dto';

interface ParsedRow {
  employeeCode?: string;
  deviceUserId?: string;
  workDate: string | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
}

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'attendance');

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(ImportBatch) private batchRepo: Repository<ImportBatch>,
    @InjectRepository(ImportRow) private rowRepo: Repository<ImportRow>,
    @InjectRepository(AttendanceRecord) private recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private resolver: AttendanceResolverService,
    private dataSource: DataSource,
  ) {}

  // ── 1. Upload ───────────────────────────────────────────────────────────────

  async upload(uploadedBy: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    mkdirSync(UPLOAD_DIR, { recursive: true });
    const storedName = `${randomUUID()}-${file.originalname}`;
    const filePath = join(UPLOAD_DIR, storedName);
    writeFileSync(filePath, file.buffer);

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headerRow = (rows[0] ?? []).map((h) => String(h ?? ''));

    const batch = await this.batchRepo.save(
      this.batchRepo.create({
        type: ImportType.Attendance,
        fileName: file.originalname,
        fileUrl: join('uploads', 'attendance', storedName),
        uploadedBy,
        status: ImportBatchStatus.Uploaded,
        totalRows: Math.max(0, rows.length - 1),
      }),
    );

    return { batchId: batch.id, headerRow };
  }

  // ── 2. Map & parse ──────────────────────────────────────────────────────────

  async mapColumns(batchId: string, dto: ColumnMappingDto) {
    const batch = await this.findBatchById(batchId);

    const rows = this.readRows(batch.fileUrl);
    const header = (rows[0] ?? []).map((h) => String(h ?? ''));
    const dataRows = rows.slice(1);

    const colIndex = (name?: string) => (name ? header.indexOf(name) : -1);
    const employeeCodeIdx = colIndex(dto.employeeCodeColumn);
    const deviceUserIdIdx = colIndex(dto.deviceUserIdColumn);
    const dateIdx = colIndex(dto.dateColumn);
    const timeIdxs = dto.timeColumns.map((c) => colIndex(c)).filter((i) => i >= 0);

    await this.dataSource.transaction(async (em) => {
      await em.delete(ImportRow, { importBatchId: batchId });

      const importRows = dataRows.map((raw, i) => {
        const parsed = this.parseRow(raw, {
          employeeCodeIdx,
          deviceUserIdIdx,
          dateIdx,
          timeIdxs,
        });
        return em.create(ImportRow, {
          importBatchId: batchId,
          rowNumber: i + 2, // 1-indexed + header row
          raw,
          parsed: parsed as unknown as Record<string, unknown>,
          status: ImportRowStatus.Ok,
          message: null,
        });
      });

      if (importRows.length > 0) await em.save(ImportRow, importRows);

      await em.update(ImportBatch, { id: batchId }, {
        columnMapping: dto,
        totalRows: importRows.length,
      } as never);
    });

    return this.rowRepo.find({ where: { importBatchId: batchId }, order: { rowNumber: 'ASC' } });
  }

  // ── 3. Validate ─────────────────────────────────────────────────────────────

  async validate(batchId: string) {
    const batch = await this.findBatchById(batchId);
    const rows = await this.rowRepo.find({ where: { importBatchId: batchId }, order: { rowNumber: 'ASC' } });

    const seenPerEmployeeDate = new Map<string, number>(); // key -> count seen so far

    for (const row of rows) {
      const parsed = row.parsed as unknown as ParsedRow | null;

      if (!parsed?.workDate || (!parsed.checkInAt && !parsed.checkOutAt)) {
        await this.markRow(row, ImportRowStatus.Error, 'Could not parse a date or punch time for this row');
        continue;
      }

      let matchedEmployee: Employee | null = null;
      if (parsed.employeeCode) {
        matchedEmployee = await this.employeeRepo.findOne({ where: { employeeCode: parsed.employeeCode } });
      }
      if (!matchedEmployee && parsed.deviceUserId) {
        matchedEmployee = await this.employeeRepo.findOne({ where: { deviceUserId: parsed.deviceUserId } });
      }

      if (!matchedEmployee) {
        const id = parsed.employeeCode ?? parsed.deviceUserId ?? '(none)';
        await this.markRow(row, ImportRowStatus.Error, `No employee found for code/device id "${id}"`, null);
        continue;
      }

      if (parsed.checkInAt && parsed.checkOutAt && parsed.checkOutAt < parsed.checkInAt) {
        await this.markRow(row, ImportRowStatus.Error, 'Check-out time is before check-in time', matchedEmployee.id);
        continue;
      }

      const key = `${matchedEmployee.id}:${parsed.workDate}`;
      const seenCount = seenPerEmployeeDate.get(key) ?? 0;
      seenPerEmployeeDate.set(key, seenCount + 1);

      if (seenCount > 0) {
        await this.markRow(
          row,
          ImportRowStatus.Warning,
          `Duplicate punch rows for this employee/date in the same file — later rows override earlier ones`,
          matchedEmployee.id,
        );
        continue;
      }

      const existingRecord = await this.recordRepo.findOne({
        where: { employeeId: matchedEmployee.id, workDate: parsed.workDate },
      });
      if (existingRecord && existingRecord.importBatchId !== batchId) {
        await this.markRow(
          row,
          ImportRowStatus.Warning,
          `Will update the existing attendance record for ${matchedEmployee.firstName} ${matchedEmployee.lastName} on ${parsed.workDate}`,
          matchedEmployee.id,
        );
        continue;
      }

      await this.markRow(row, ImportRowStatus.Ok, null, matchedEmployee.id);
    }

    const updated = await this.rowRepo.find({ where: { importBatchId: batchId }, order: { rowNumber: 'ASC' } });
    const successRows = updated.filter((r) => r.status !== ImportRowStatus.Error).length;
    const errorRows = updated.filter((r) => r.status === ImportRowStatus.Error).length;

    await this.batchRepo.update(
      { id: batch.id },
      { status: ImportBatchStatus.Validated, successRows, errorRows },
    );

    return updated;
  }

  // ── 4. Commit ───────────────────────────────────────────────────────────────

  async commit(batchId: string, dto: CommitImportDto) {
    const batch = await this.findBatchById(batchId);

    const rows = await this.rowRepo.find({ where: { importBatchId: batchId } });
    const committable = rows.filter((r) => {
      if (r.status === ImportRowStatus.Error) return false;
      if (dto.rowIds?.length) return dto.rowIds.includes(r.id);
      return true;
    });

    if (committable.length === 0) {
      throw new BadRequestException('No committable rows in this batch');
    }

    const affected: Array<{ employeeId: string; workDate: string }> = [];

    await this.dataSource.transaction(async (em) => {
      for (const row of committable) {
        const parsed = row.parsed as unknown as ParsedRow;
        if (!row.matchedEmployeeId || !parsed.workDate) continue;

        await em.upsert(
          AttendanceRecord,
          {
            employeeId: row.matchedEmployeeId,
            workDate: parsed.workDate,
            checkInAt: parsed.checkInAt,
            checkOutAt: parsed.checkOutAt,
            source: AttendanceSource.DeviceImport,
            status: AttendanceStatus.Present, // resolved below
            importBatchId: batchId,
          },
          { conflictPaths: ['employeeId', 'workDate'] },
        );

        affected.push({ employeeId: row.matchedEmployeeId, workDate: parsed.workDate });
      }

      await em.update(
        ImportBatch,
        { id: batchId },
        {
          status: committable.length === rows.length
            ? ImportBatchStatus.Imported
            : ImportBatchStatus.PartiallyImported,
          startedAt: batch.startedAt ?? new Date(),
          finishedAt: new Date(),
        },
      );
    });

    for (const { employeeId, workDate } of affected) {
      await this.resolver.resolveDay(employeeId, workDate);
    }

    return this.batchRepo.findOne({ where: { id: batchId } });
  }

  // ── 5. Rollback ─────────────────────────────────────────────────────────────

  async rollback(batchId: string) {
    await this.findBatchById(batchId);

    const records = await this.recordRepo.find({ where: { importBatchId: batchId } });
    await this.recordRepo.remove(records);

    for (const record of records) {
      await this.resolver.resolveDay(record.employeeId, record.workDate);
    }

    return { rolledBack: records.length };
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  findBatches() {
    return this.batchRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getRows(batchId: string) {
    await this.findBatchById(batchId);
    return this.rowRepo.find({ where: { importBatchId: batchId }, order: { rowNumber: 'ASC' } });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findBatchById(id: string) {
    const batch = await this.batchRepo.findOne({ where: { id } });
    if (!batch) throw new NotFoundException('Import batch not found');
    return batch;
  }

  private async markRow(
    row: ImportRow,
    status: ImportRowStatus,
    message: string | null,
    matchedEmployeeId?: string | null,
  ) {
    row.status = status;
    row.message = message;
    if (matchedEmployeeId !== undefined) row.matchedEmployeeId = matchedEmployeeId;
    await this.rowRepo.save(row);
  }

  private readRows(relativeFileUrl: string): unknown[][] {
    const filePath = join(process.cwd(), relativeFileUrl);
    // cellDates converts date-like cells (including CSV cells SheetJS sniffs as dates)
    // into real Date objects instead of ambiguous Excel serial numbers or locale strings.
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 });
  }

  private parseRow(
    raw: unknown[],
    idx: { employeeCodeIdx: number; deviceUserIdIdx: number; dateIdx: number; timeIdxs: number[] },
  ): ParsedRow {
    const employeeCode = idx.employeeCodeIdx >= 0 ? this.cellString(raw, idx.employeeCodeIdx) : undefined;
    const deviceUserId = idx.deviceUserIdIdx >= 0 ? this.cellString(raw, idx.deviceUserIdIdx) : undefined;
    const dateCell = idx.dateIdx >= 0 ? this.cellRaw(raw, idx.dateIdx) : undefined;
    const workDate = dateCell !== undefined ? this.parseDate(dateCell) : null;

    const times: Date[] = [];
    if (workDate) {
      for (const i of idx.timeIdxs) {
        const cell = this.cellRaw(raw, i);
        if (cell === undefined) continue;
        const combined = this.parseDateTime(workDate, cell);
        if (combined) times.push(combined);
      }
    }
    times.sort((a, b) => a.getTime() - b.getTime());

    return {
      employeeCode,
      deviceUserId,
      workDate,
      checkInAt: times[0] ?? null,
      checkOutAt: times.length > 1 ? times[times.length - 1] : null,
    };
  }

  private cellRaw(raw: unknown[], index: number): unknown {
    const value = raw[index];
    if (value === undefined || value === null || value === '') return undefined;
    return value;
  }

  private cellString(raw: unknown[], index: number): string | undefined {
    const value = this.cellRaw(raw, index);
    return value === undefined ? undefined : String(value).trim();
  }

  private parseDate(value: unknown): string | null {
    // With cellDates:true, SheetJS already converts date-like cells (including CSV
    // cells it sniffs as dates) into real Date objects — use that directly rather
    // than re-parsing its string form, which can shift by a day across timezones.
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return value.toISOString().slice(0, 10);
    }
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  private parseDateTime(workDate: string, timeValue: unknown): Date | null {
    if (timeValue instanceof Date) {
      if (Number.isNaN(timeValue.getTime())) return null;
      // A bare time-of-day cell decodes to a Date anchored at the 1899-12-30 Excel
      // epoch — combine its time-of-day with the row's actual work date.
      const hours = String(timeValue.getUTCHours()).padStart(2, '0');
      const minutes = String(timeValue.getUTCMinutes()).padStart(2, '0');
      const seconds = String(timeValue.getUTCSeconds()).padStart(2, '0');
      const combined = new Date(`${workDate}T${hours}:${minutes}:${seconds}`);
      return Number.isNaN(combined.getTime()) ? null : combined;
    }

    const timeStr = String(timeValue).trim();
    // If the cell already looks like a full timestamp, parse it directly;
    // otherwise combine the row's date with a bare time-of-day value.
    const direct = new Date(timeStr);
    if (!Number.isNaN(direct.getTime()) && /\d{4}-\d{2}-\d{2}/.test(timeStr)) {
      return direct;
    }
    const combined = new Date(`${workDate}T${timeStr}`);
    return Number.isNaN(combined.getTime()) ? null : combined;
  }
}
