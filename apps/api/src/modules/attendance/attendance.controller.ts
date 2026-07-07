import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permission } from '@hrm/types';
import { AttendanceService } from './attendance.service';
import { ImportService } from './import.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/create-shift.dto';
import { CreateRosterDto } from './dto/create-roster.dto';
import { AssignRosterDto } from './dto/assign-roster.dto';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/create-holiday.dto';
import { ManualEntryDto } from './dto/manual-entry.dto';
import { CreateRegularizationDto } from './dto/create-regularization.dto';
import { ColumnMappingDto } from './dto/column-mapping.dto';
import { CommitImportDto } from './dto/commit-import.dto';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly svc: AttendanceService,
    private readonly importSvc: ImportService,
  ) {}

  // ── Shifts ──────────────────────────────────────────────────────────────────

  @Get('shifts')
  getShifts() {
    return this.svc.findShifts();
  }

  @Post('shifts')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageShift)
  createShift(@Body() dto: CreateShiftDto) {
    return this.svc.createShift(dto);
  }

  @Patch('shifts/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageShift)
  updateShift(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShiftDto) {
    return this.svc.updateShift(id, dto);
  }

  @Delete('shifts/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageShift)
  deleteShift(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteShift(id);
  }

  // ── Rosters ─────────────────────────────────────────────────────────────────

  @Get('rosters')
  getRosters() {
    return this.svc.findRosters();
  }

  @Post('rosters')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageRoster)
  createRoster(@Body() dto: CreateRosterDto) {
    return this.svc.createRoster(dto);
  }

  @Get('rosters/:id/assignments')
  getRosterAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getRosterAssignments(id);
  }

  @Post('rosters/:id/assignments')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageRoster)
  assignRoster(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRosterDto) {
    return this.svc.assignRoster(id, dto);
  }

  // ── Holidays ────────────────────────────────────────────────────────────────

  @Get('holidays')
  getHolidays() {
    return this.svc.findHolidays();
  }

  @Post('holidays')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageHoliday)
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.svc.createHoliday(dto);
  }

  @Patch('holidays/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageHoliday)
  updateHoliday(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHolidayDto) {
    return this.svc.updateHoliday(id, dto);
  }

  @Delete('holidays/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManageHoliday)
  deleteHoliday(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteHoliday(id);
  }

  // ── Clock in/out & manual entry ─────────────────────────────────────────────

  @Post('clock-in')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceClockIn)
  clockIn(@CurrentUser() user: JwtPayload) {
    return this.svc.clockIn(user.sub);
  }

  @Post('clock-out')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceClockIn)
  clockOut(@CurrentUser() user: JwtPayload) {
    return this.svc.clockOut(user.sub);
  }

  @Post('manual')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceManual)
  manualEntry(@Body() dto: ManualEntryDto) {
    return this.svc.manualEntry(dto);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceViewOwn)
  getMyAttendance(
    @CurrentUser() user: JwtPayload,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.svc.getMyAttendance(user.sub, year, month);
  }

  @Get('team')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceViewOwn)
  getTeamAttendance(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const canViewAll = user.permissions.includes(Permission.AttendanceViewAll);
    return this.svc.getTeamAttendance(user.sub, from, to, departmentId, canViewAll);
  }

  // ── Regularization ──────────────────────────────────────────────────────────

  @Post('regularizations')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceRegularize)
  requestRegularization(@CurrentUser() user: JwtPayload, @Body() dto: CreateRegularizationDto) {
    return this.svc.requestRegularization(user.sub, dto);
  }

  @Get('regularizations/me')
  getMyRegularizations(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyRegularizations(user.sub);
  }

  @Get('regularizations/all')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.AttendanceViewAll)
  getAllRegularizations() {
    return this.svc.getAllRegularizations();
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  @Get('import')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ImportUpload)
  getImportBatches() {
    return this.importSvc.findBatches();
  }

  @Post('import/upload')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ImportUpload)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file'))
  uploadImport(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return this.importSvc.upload(user.sub, file);
  }

  @Post('import/:batchId/map')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ImportUpload)
  mapImportColumns(@Param('batchId', ParseUUIDPipe) batchId: string, @Body() dto: ColumnMappingDto) {
    return this.importSvc.mapColumns(batchId, dto);
  }

  @Post('import/:batchId/validate')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ImportUpload)
  validateImport(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.importSvc.validate(batchId);
  }

  @Get('import/:batchId/rows')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ImportUpload)
  getImportRows(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.importSvc.getRows(batchId);
  }

  @Post('import/:batchId/commit')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ImportCommit)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  commitImport(@Param('batchId', ParseUUIDPipe) batchId: string, @Body() dto: CommitImportDto) {
    return this.importSvc.commit(batchId, dto);
  }

  @Post('import/:batchId/rollback')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ImportCommit)
  rollbackImport(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.importSvc.rollback(batchId);
  }
}
