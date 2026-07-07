import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CompensationService } from './compensation.service';
import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { UpdateSalaryComponentDto } from './dto/update-salary-component.dto';
import { CreateSalaryGradeDto } from './dto/create-salary-grade.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreatePfAccountDto, UpdatePfAccountDto } from './dto/create-pf-account.dto';
import { CreateBenefitDto, UpdateBenefitDto } from './dto/create-benefit.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permission } from '@hrm/types';

@Controller('compensation')
export class CompensationController {
  constructor(private readonly svc: CompensationService) {}

  // ── Salary Components ───────────────────────────────────────────────────────

  @Get('components')
  @Permissions(Permission.SalaryView)
  listComponents() {
    return this.svc.findAllComponents();
  }

  @Get('components/:id')
  @Permissions(Permission.SalaryView)
  getComponent(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOneComponent(id);
  }

  @Post('components')
  @Permissions(Permission.SalaryManage)
  createComponent(@Body() dto: CreateSalaryComponentDto) {
    return this.svc.createComponent(dto);
  }

  @Patch('components/:id')
  @Permissions(Permission.SalaryManage)
  updateComponent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryComponentDto,
  ) {
    return this.svc.updateComponent(id, dto);
  }

  @Delete('components/:id')
  @Permissions(Permission.SalaryManage)
  deleteComponent(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteComponent(id);
  }

  // ── Salary Grades ───────────────────────────────────────────────────────────

  @Get('grades')
  @Permissions(Permission.SalaryView)
  listGrades() {
    return this.svc.findAllGrades();
  }

  @Get('grades/:id')
  @Permissions(Permission.SalaryView)
  getGrade(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOneGrade(id);
  }

  @Post('grades')
  @Permissions(Permission.SalaryManage)
  createGrade(@Body() dto: CreateSalaryGradeDto) {
    return this.svc.createGrade(dto);
  }

  @Patch('grades/:id')
  @Permissions(Permission.SalaryManage)
  updateGrade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateSalaryGradeDto>,
  ) {
    return this.svc.updateGrade(id, dto);
  }

  @Delete('grades/:id')
  @Permissions(Permission.SalaryManage)
  deleteGrade(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteGrade(id);
  }

  // ── Salary Structures ───────────────────────────────────────────────────────

  // Not gated by @Permissions(SalaryView) — self-view is allowed when the org enables
  // `allow_self_salary_view`. CompensationService.assertSalaryAccess() enforces the real rule:
  // SalaryView/SalaryManage always pass; otherwise only the employee's own record, and only
  // when the setting is on.
  @Get('employees/:employeeId/salary')
  getCurrentSalary(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.getCurrentStructure(employeeId, user.sub, user.permissions);
  }

  @Get('employees/:employeeId/salary/history')
  getSalaryHistory(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.getSalaryHistory(employeeId, user.sub, user.permissions);
  }

  @Post('employees/:employeeId/salary')
  @Permissions(Permission.SalaryManage)
  createSalaryStructure(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateSalaryStructureDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.createSalaryStructure(employeeId, dto, user.sub);
  }

  @Post('salary/preview')
  @Permissions(Permission.SalaryManage)
  previewSalary(
    @Body() dto: CreateSalaryStructureDto,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.svc.previewSalary(dto, employeeId ?? null);
  }

  // ── PF Accounts ─────────────────────────────────────────────────────────────

  @Get('employees/:employeeId/pf')
  @Permissions(Permission.SalaryView)
  getPf(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.svc.getPfAccount(employeeId);
  }

  @Post('employees/:employeeId/pf')
  @Permissions(Permission.SalaryManage)
  createPf(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreatePfAccountDto,
  ) {
    return this.svc.createPfAccount(employeeId, dto);
  }

  @Patch('employees/:employeeId/pf/:id')
  @Permissions(Permission.SalaryManage)
  updatePf(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePfAccountDto,
  ) {
    return this.svc.updatePfAccount(employeeId, id, dto);
  }

  // ── Employee Benefits ───────────────────────────────────────────────────────

  @Get('employees/:employeeId/benefits')
  @Permissions(Permission.SalaryView)
  getBenefits(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.svc.getBenefits(employeeId);
  }

  @Post('employees/:employeeId/benefits')
  @Permissions(Permission.SalaryManage)
  createBenefit(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateBenefitDto,
  ) {
    return this.svc.createBenefit(employeeId, dto);
  }

  @Patch('employees/:employeeId/benefits/:id')
  @Permissions(Permission.SalaryManage)
  updateBenefit(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBenefitDto,
  ) {
    return this.svc.updateBenefit(employeeId, id, dto);
  }

  @Delete('employees/:employeeId/benefits/:id')
  @Permissions(Permission.SalaryManage)
  deleteBenefit(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteBenefit(employeeId, id);
  }
}
