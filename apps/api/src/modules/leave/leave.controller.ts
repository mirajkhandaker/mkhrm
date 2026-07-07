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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permission } from '@hrm/types';
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';

@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly svc: LeaveService) {}

  // ── Leave Types ─────────────────────────────────────────────────────────────

  @Get('types')
  getLeaveTypes(@Query('all') all?: string) {
    return this.svc.findLeaveTypes(all !== 'true');
  }

  @Post('types')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  createLeaveType(@Body() dto: CreateLeaveTypeDto) {
    return this.svc.createLeaveType(dto);
  }

  @Patch('types/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  updateLeaveType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.svc.updateLeaveType(id, dto);
  }

  @Delete('types/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  deactivateLeaveType(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deactivateLeaveType(id);
  }

  // ── Leave Policies ──────────────────────────────────────────────────────────

  @Get('policies')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  getPolicies(@Query('leaveTypeId') leaveTypeId?: string) {
    return this.svc.findLeavePolicies(leaveTypeId);
  }

  @Post('policies')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  createPolicy(@Body() dto: CreateLeavePolicyDto) {
    return this.svc.createLeavePolicy(dto);
  }

  @Delete('policies/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  deletePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteLeavePolicy(id);
  }

  // ── Balances ────────────────────────────────────────────────────────────────

  @Get('balances')
  getMyBalances(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: string,
  ) {
    return this.svc.getMyBalances(user.sub, year ? Number(year) : undefined);
  }

  @Get('balances/employee/:id')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  getEmployeeBalances(
    @Param('id', ParseUUIDPipe) employeeId: string,
    @Query('year') year?: string,
  ) {
    return this.svc.getBalancesForEmployee(employeeId, year ? Number(year) : undefined);
  }

  @Post('balances/adjust')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  adjustBalance(@Body() dto: AdjustBalanceDto) {
    return this.svc.adjustBalance(dto);
  }

  // ── Accrual ─────────────────────────────────────────────────────────────────

  @Post('accrue')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  accrueLeave(
    @Body() body: { year: number; month: number },
  ) {
    return this.svc.accrueLeaveForMonth(body.year, body.month);
  }

  // ── Applications ────────────────────────────────────────────────────────────

  @Get('preview-days')
  previewDays(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('isHalfDay') isHalfDay?: string,
  ) {
    return this.svc.previewDays(startDate, endDate, isHalfDay === 'true');
  }

  @Get('applications')
  getMyApplications(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyApplications(user.sub);
  }

  @Get('applications/all')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  getAllApplications(@Query('status') status?: string) {
    return this.svc.getAllApplications(status);
  }

  @Get('applications/team')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveApprove)
  getTeamApplications(
    @CurrentUser() user: JwtPayload,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.svc.getTeamApplications(user.sub, year, month);
  }

  @Post('applications')
  applyForLeave(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApplyLeaveDto,
  ) {
    return this.svc.applyForLeave(user.sub, dto);
  }

  @Delete('applications/:id')
  cancelApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.cancelApplication(id, user.sub);
  }

  @Get('ledger')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveManage)
  getLedger(@Query('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.svc.getLedger(employeeId);
  }

  @Get('calendar/team')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.LeaveApprove)
  getTeamCalendar(
    @CurrentUser() user: JwtPayload,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.svc.getTeamApplications(user.sub, year, month);
  }
}
