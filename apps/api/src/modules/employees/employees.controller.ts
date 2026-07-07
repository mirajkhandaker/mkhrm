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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { EmployeesService } from './employees.service';
import { DepartmentsService } from './departments.service';
import { DesignationsService } from './designations.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JobChangeDto } from './dto/job-change.dto';
import { StartProbationDto, ProbationActionDto } from './dto/probation-action.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/create-education.dto';
import { CreatePreviousEmploymentDto, UpdatePreviousEmploymentDto } from './dto/create-previous-employment.dto';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permission } from '@hrm/types';

@Controller()
export class EmployeesController {
  constructor(
    private employees: EmployeesService,
    private departments: DepartmentsService,
    private designations: DesignationsService,
  ) {}

  // ── Employees ──────────────────────────────────────────────────────────────

  @Get('employees')
  @Permissions(Permission.EmployeeReadAll)
  list(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.employees.findAll({
      search,
      departmentId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('employees/confirmations-due')
  @Permissions(Permission.EmployeeReadAll)
  confirmationsDue(@Query('days') days?: string) {
    return this.employees.getConfirmationsDue(days ? Number(days) : 7);
  }

  @Get('employees/:id')
  @Permissions(Permission.EmployeeRead)
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.findOne(id);
  }

  @Post('employees')
  @Permissions(Permission.EmployeeCreate)
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: JwtPayload) {
    return this.employees.create(dto, user.sub);
  }

  @Patch('employees/:id')
  @Permissions(Permission.EmployeeUpdate)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @Patch('employees/:id/roles')
  @Permissions(Permission.RoleManage)
  assignRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolesDto) {
    return this.employees.assignRoles(id, dto);
  }

  // ── Job history ────────────────────────────────────────────────────────────

  @Get('employees/:id/job-history')
  @Permissions(Permission.EmployeeRead)
  jobHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.getJobHistory(id);
  }

  @Post('employees/:id/job-change')
  @Permissions(Permission.EmployeeUpdate)
  jobChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobChangeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.employees.applyJobChange(id, dto, user.sub);
  }

  @Get('employees/:id/status-history')
  @Permissions(Permission.EmployeeRead)
  statusHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.getStatusHistory(id);
  }

  // ── Probation ──────────────────────────────────────────────────────────────

  @Get('employees/:id/probation')
  @Permissions(Permission.EmployeeRead)
  getProbation(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.getProbationRecords(id);
  }

  @Post('employees/:id/probation')
  @Permissions(Permission.EmployeeUpdate)
  startProbation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StartProbationDto) {
    return this.employees.startProbation(id, dto);
  }

  @Post('employees/:id/probation/action')
  @Permissions(Permission.EmployeeUpdate)
  probationAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProbationActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.employees.probationAction(id, dto, user.sub);
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  @Get('employees/:id/documents')
  @Permissions(Permission.EmployeeRead)
  listDocuments(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.listDocuments(id);
  }

  @Post('employees/:id/documents')
  @Permissions(Permission.EmployeeUpdate)
  @UseInterceptors(FileInterceptor('file'))
  addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.employees.addDocument(id, dto, file);
  }

  @Get('employees/:id/documents/:documentId/file')
  async getDocumentFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ) {
    const doc = await this.employees.getDocumentForDownload(id, documentId);
    const filePath = join(process.cwd(), doc.fileUrl);
    if (!existsSync(filePath)) throw new BadRequestException('File not found on disk');
    const safeFileName = doc.fileName.replace(/[^\x20-\x7E]/g, '').replace(/"/g, "'");
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    createReadStream(filePath).pipe(res);
  }

  @Delete('employees/:id/documents/:documentId')
  @Permissions(Permission.EmployeeUpdate)
  deleteDocument(@Param('id', ParseUUIDPipe) id: string, @Param('documentId', ParseUUIDPipe) documentId: string) {
    return this.employees.deleteDocument(id, documentId);
  }

  // ── Education ──────────────────────────────────────────────────────────────

  @Get('employees/:id/education')
  @Permissions(Permission.EmployeeRead)
  listEducation(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.listEducation(id);
  }

  @Post('employees/:id/education')
  @Permissions(Permission.EmployeeUpdate)
  addEducation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateEducationDto) {
    return this.employees.addEducation(id, dto);
  }

  @Patch('employees/:id/education/:educationId')
  @Permissions(Permission.EmployeeUpdate)
  updateEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('educationId', ParseUUIDPipe) educationId: string,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.employees.updateEducation(id, educationId, dto);
  }

  @Delete('employees/:id/education/:educationId')
  @Permissions(Permission.EmployeeUpdate)
  deleteEducation(@Param('id', ParseUUIDPipe) id: string, @Param('educationId', ParseUUIDPipe) educationId: string) {
    return this.employees.deleteEducation(id, educationId);
  }

  // ── Previous employment ─────────────────────────────────────────────────────

  @Get('employees/:id/previous-employment')
  @Permissions(Permission.EmployeeRead)
  listPreviousEmployment(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.listPreviousEmployment(id);
  }

  @Post('employees/:id/previous-employment')
  @Permissions(Permission.EmployeeUpdate)
  addPreviousEmployment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePreviousEmploymentDto) {
    return this.employees.addPreviousEmployment(id, dto);
  }

  @Patch('employees/:id/previous-employment/:prevId')
  @Permissions(Permission.EmployeeUpdate)
  updatePreviousEmployment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prevId', ParseUUIDPipe) prevId: string,
    @Body() dto: UpdatePreviousEmploymentDto,
  ) {
    return this.employees.updatePreviousEmployment(id, prevId, dto);
  }

  @Delete('employees/:id/previous-employment/:prevId')
  @Permissions(Permission.EmployeeUpdate)
  deletePreviousEmployment(@Param('id', ParseUUIDPipe) id: string, @Param('prevId', ParseUUIDPipe) prevId: string) {
    return this.employees.deletePreviousEmployment(id, prevId);
  }

  // ── Departments ────────────────────────────────────────────────────────────

  @Get('departments')
  @Permissions(Permission.DepartmentManage)
  listDepts() {
    return this.departments.findAll();
  }

  @Get('departments/:id')
  @Permissions(Permission.DepartmentManage)
  getDept(@Param('id', ParseUUIDPipe) id: string) {
    return this.departments.findOne(id);
  }

  @Post('departments')
  @Permissions(Permission.DepartmentManage)
  createDept(@Body() dto: CreateDepartmentDto) {
    return this.departments.create(dto);
  }

  @Patch('departments/:id')
  @Permissions(Permission.DepartmentManage)
  updateDept(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(id, dto);
  }

  @Delete('departments/:id')
  @Permissions(Permission.DepartmentManage)
  deleteDept(@Param('id', ParseUUIDPipe) id: string) {
    return this.departments.remove(id);
  }

  // ── Designations ───────────────────────────────────────────────────────────

  @Get('designations')
  @Permissions(Permission.DesignationManage)
  listDesig(@Query('departmentId') departmentId?: string) {
    return this.designations.findAll(departmentId);
  }

  @Post('designations')
  @Permissions(Permission.DesignationManage)
  createDesig(@Body() dto: CreateDesignationDto) {
    return this.designations.create(dto);
  }

  @Patch('designations/:id')
  @Permissions(Permission.DesignationManage)
  updateDesig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDesignationDto,
  ) {
    return this.designations.update(id, dto);
  }

  @Delete('designations/:id')
  @Permissions(Permission.DesignationManage)
  deleteDesig(@Param('id', ParseUUIDPipe) id: string) {
    return this.designations.remove(id);
  }
}
