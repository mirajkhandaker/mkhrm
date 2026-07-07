import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@hrm/types';
import { ReportsService } from './reports.service';
import { buildExportBuffer, exportContentType, exportFilename, ExportFormat } from '../../common/utils/export.util';

function parseFormat(format?: string): ExportFormat {
  return format === 'csv' ? 'csv' : 'xlsx';
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports/export')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('attendance')
  @Permissions(Permission.ReportsView)
  async exportAttendance(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.svc.getAttendanceRows(from, to);
    this.send(res, rows, 'attendance', parseFormat(format));
  }

  @Get('leave-balances')
  @Permissions(Permission.ReportsView)
  async exportLeaveBalances(
    @Query('year') year: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.svc.getLeaveBalanceRows(year ? Number(year) : new Date().getFullYear());
    this.send(res, rows, 'leave-balances', parseFormat(format));
  }

  @Get('salary-summary')
  @Permissions(Permission.ExportsFinance)
  async exportSalarySummary(
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.svc.getSalarySummaryRows();
    this.send(res, rows, 'salary-summary', parseFormat(format));
  }

  @Get('expenses')
  @Permissions(Permission.ExportsFinance)
  async exportExpenses(
    @Query('status') status: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const rows = await this.svc.getExpenseRows(status);
    this.send(res, rows, 'expenses', parseFormat(format));
  }

  private send(res: Response, rows: Record<string, unknown>[], baseName: string, format: ExportFormat) {
    const buffer = buildExportBuffer(rows, format, baseName);
    res.setHeader('Content-Type', exportContentType(format));
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename(baseName, format)}"`);
    res.send(buffer);
  }
}
