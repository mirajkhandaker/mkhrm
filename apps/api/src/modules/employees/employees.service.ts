import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { Employee } from '../../database/entities/employees/employee.entity';
import { JobChange } from '../../database/entities/employees/job-change.entity';
import { ProbationRecord } from '../../database/entities/employees/probation-record.entity';
import { EmploymentStatusHistory } from '../../database/entities/employees/employment-status-history.entity';
import { Document } from '../../database/entities/employees/document.entity';
import { Education } from '../../database/entities/employees/education.entity';
import { PreviousEmployment } from '../../database/entities/employees/previous-employment.entity';
import { User } from '../../database/entities/auth/user.entity';
import { Role } from '../../database/entities/auth/role.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JobChangeDto } from './dto/job-change.dto';
import { StartProbationDto, ProbationActionDto } from './dto/probation-action.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/create-education.dto';
import { CreatePreviousEmploymentDto, UpdatePreviousEmploymentDto } from './dto/create-previous-employment.dto';
import {
  EmploymentStatus,
  EmploymentStatusChangeRef,
  ProbationStatus,
  UserStatus,
  RoleName,
} from '@hrm/types';

const DOCUMENT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'documents');
const DOCUMENT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const DOCUMENT_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(JobChange) private jobChangeRepo: Repository<JobChange>,
    @InjectRepository(ProbationRecord) private probationRepo: Repository<ProbationRecord>,
    @InjectRepository(EmploymentStatusHistory) private historyRepo: Repository<EmploymentStatusHistory>,
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    @InjectRepository(Education) private educationRepo: Repository<Education>,
    @InjectRepository(PreviousEmployment) private previousEmploymentRepo: Repository<PreviousEmployment>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    private dataSource: DataSource,
  ) {}

  async findAll(query: { search?: string; departmentId?: string; status?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const qb = this.empRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.department', 'dept')
      .leftJoinAndSelect('e.designation', 'desig')
      .leftJoinAndSelect('e.user', 'u')
      .orderBy('e.lastName', 'ASC')
      .skip(skip)
      .take(limit);

    if (query.search) {
      qb.andWhere(
        '(e.first_name ILIKE :s OR e.last_name ILIKE :s OR e.employee_code ILIKE :s OR u.email ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.departmentId) {
      qb.andWhere('e.department_id = :deptId', { deptId: query.departmentId });
    }
    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const emp = await this.empRepo.findOne({
      where: { id },
      relations: ['user', 'user.roles', 'department', 'designation', 'lineManager'],
    });
    if (!emp) throw new NotFoundException(`Employee ${id} not found`);
    return emp;
  }

  async assignRoles(id: string, dto: AssignRolesDto) {
    const emp = await this.empRepo.findOne({ where: { id }, relations: ['user'] });
    if (!emp) throw new NotFoundException(`Employee ${id} not found`);

    const roles = dto.roleIds.length
      ? await this.roleRepo.findBy({ id: In(dto.roleIds) })
      : [];
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more roleIds do not exist');
    }

    const user = await this.userRepo.findOne({ where: { id: emp.userId } });
    if (!user) throw new NotFoundException('User account not found for this employee');
    user.roles = roles;
    await this.userRepo.save(user);

    return this.findOne(id);
  }

  async create(dto: CreateEmployeeDto, createdBy: string) {
    return this.dataSource.transaction(async (em) => {
      const existingUser = await em.findOne(User, { where: { email: dto.email } });
      if (existingUser) throw new ConflictException(`Email ${dto.email} already in use`);

      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const passwordHash = await argon2.hash(tempPassword);
      const user = em.create(User, {
        email: dto.email,
        passwordHash,
        status: UserStatus.Active,
      });
      const savedUser = await em.save(User, user);

      const defaultRole = await em.findOne(Role, { where: { name: RoleName.Employee } });
      if (defaultRole) {
        savedUser.roles = [defaultRole];
        await em.save(User, savedUser);
      }

      const code = await this.generateCode(em);
      const emp = em.create(Employee, {
        userId: savedUser.id,
        employeeCode: code,
        firstName: dto.firstName,
        lastName: dto.lastName,
        joinDate: dto.joinDate,
        employmentType: dto.employmentType,
        employmentStatus: EmploymentStatus.Probation,
        gender: dto.gender ?? null,
        dob: dto.dob ?? null,
        phone: dto.phone ?? null,
        personalEmail: dto.personalEmail ?? null,
        address: dto.address ?? null,
        departmentId: dto.departmentId ?? null,
        designationId: dto.designationId ?? null,
        lineManagerId: dto.lineManagerId ?? null,
      });
      const savedEmp = await em.save(Employee, emp);

      await em.save(EmploymentStatusHistory, em.create(EmploymentStatusHistory, {
        employeeId: savedEmp.id,
        fromStatus: null,
        toStatus: EmploymentStatus.Probation,
        effectiveDate: dto.joinDate,
        reason: 'Initial hire',
        refType: EmploymentStatusChangeRef.Manual,
        createdBy,
      }));

      return savedEmp;
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const emp = await this.findOne(id);
    Object.assign(emp, {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.dob !== undefined && { dob: dto.dob }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.personalEmail !== undefined && { personalEmail: dto.personalEmail }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.designationId !== undefined && { designationId: dto.designationId }),
      ...(dto.lineManagerId !== undefined && { lineManagerId: dto.lineManagerId }),
    });
    return this.empRepo.save(emp);
  }

  async applyJobChange(employeeId: string, dto: JobChangeDto, actorId: string) {
    const emp = await this.findOne(employeeId);

    return this.dataSource.transaction(async (em) => {
      const change = em.create(JobChange, {
        employeeId,
        type: dto.type,
        effectiveDate: dto.effectiveDate,
        fromDepartmentId: emp.departmentId,
        toDepartmentId: dto.toDepartmentId ?? emp.departmentId,
        fromDesignationId: emp.designationId,
        toDesignationId: dto.toDesignationId ?? emp.designationId,
        fromManagerId: emp.lineManagerId,
        toManagerId: dto.toManagerId ?? emp.lineManagerId,
        reason: dto.reason ?? null,
        note: dto.note ?? null,
        createdBy: actorId,
      });
      const saved = await em.save(JobChange, change);

      await em.update(Employee, employeeId, {
        ...(dto.toDepartmentId && { departmentId: dto.toDepartmentId }),
        ...(dto.toDesignationId && { designationId: dto.toDesignationId }),
        ...(dto.toManagerId && { lineManagerId: dto.toManagerId }),
      });

      return saved;
    });
  }

  async startProbation(employeeId: string, dto: StartProbationDto) {
    await this.findOne(employeeId);
    const start = new Date(dto.startDate);
    const expected = new Date(start);
    expected.setMonth(expected.getMonth() + dto.probationMonths);

    return this.probationRepo.save(
      this.probationRepo.create({
        employeeId,
        startDate: dto.startDate,
        probationMonths: dto.probationMonths,
        expectedConfirmationDate: expected.toISOString().slice(0, 10),
        status: ProbationStatus.InProbation,
        evaluatorId: dto.evaluatorId ?? null,
      }),
    );
  }

  async probationAction(employeeId: string, dto: ProbationActionDto, actorId: string) {
    const record = await this.probationRepo.findOne({
      where: { employeeId, status: ProbationStatus.InProbation },
      order: { createdAt: 'DESC' },
    });
    if (!record) throw new NotFoundException('No active probation record found');

    return this.dataSource.transaction(async (em) => {
      const today = new Date().toISOString().slice(0, 10);

      record.status = dto.action;
      if (dto.action === ProbationStatus.Confirmed) record.confirmedOn = today;
      if (dto.action === ProbationStatus.Extended) {
        if (!dto.extendedTo) throw new BadRequestException('extendedTo required for extension');
        record.extendedTo = dto.extendedTo;
      }
      if (dto.note) record.note = dto.note;
      await em.save(ProbationRecord, record);

      let toStatus: EmploymentStatus = EmploymentStatus.Probation;
      if (dto.action === ProbationStatus.Confirmed) toStatus = EmploymentStatus.Confirmed;
      if (dto.action === ProbationStatus.Failed) toStatus = EmploymentStatus.Terminated;

      const emp = await em.findOneOrFail(Employee, { where: { id: employeeId } });
      await em.save(EmploymentStatusHistory, em.create(EmploymentStatusHistory, {
        employeeId,
        fromStatus: emp.employmentStatus,
        toStatus,
        effectiveDate: today,
        reason: `Probation ${dto.action}`,
        refType: EmploymentStatusChangeRef.Probation,
        refId: record.id,
        createdBy: actorId,
      }));
      await em.update(Employee, employeeId, { employmentStatus: toStatus });

      return record;
    });
  }

  async getJobHistory(employeeId: string) {
    await this.findOne(employeeId);
    return this.jobChangeRepo.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
    });
  }

  async getStatusHistory(employeeId: string) {
    await this.findOne(employeeId);
    return this.historyRepo.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
    });
  }

  async getProbationRecords(employeeId: string) {
    await this.findOne(employeeId);
    return this.probationRepo.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
    });
  }

  async getConfirmationsDue(daysAhead = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    return this.probationRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.employee', 'e')
      .where('p.status = :s', { s: ProbationStatus.InProbation })
      .andWhere('p.expected_confirmation_date <= :cutoff', { cutoff: cutoff.toISOString().slice(0, 10) })
      .orderBy('p.expected_confirmation_date', 'ASC')
      .getMany();
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  async listDocuments(employeeId: string) {
    await this.findOne(employeeId);
    return this.documentRepo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
  }

  async addDocument(employeeId: string, dto: CreateDocumentDto, file: Express.Multer.File) {
    await this.findOne(employeeId);
    if (!file) throw new BadRequestException('No file uploaded');
    if (!DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('File must be a JPEG, PNG, WEBP or PDF file');
    }
    if (file.size > DOCUMENT_MAX_FILE_BYTES) {
      throw new BadRequestException('File must be smaller than 5MB');
    }

    mkdirSync(DOCUMENT_UPLOAD_DIR, { recursive: true });
    const storedName = `${randomUUID()}-${file.originalname}`;
    writeFileSync(join(DOCUMENT_UPLOAD_DIR, storedName), file.buffer);

    return this.documentRepo.save(
      this.documentRepo.create({
        employeeId,
        type: dto.type,
        fileUrl: join('uploads', 'documents', storedName).replace(/\\/g, '/'),
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        expiryDate: dto.expiryDate ?? null,
        label: dto.label ?? null,
      }),
    );
  }

  async getDocumentForDownload(employeeId: string, documentId: string) {
    const doc = await this.documentRepo.findOne({ where: { id: documentId, employeeId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async deleteDocument(employeeId: string, documentId: string) {
    const doc = await this.documentRepo.findOne({ where: { id: documentId, employeeId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.documentRepo.delete({ id: documentId });
    try {
      const filePath = join(process.cwd(), doc.fileUrl);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // Non-fatal — a missing file on disk shouldn't block the DB delete.
    }
  }

  // ── Education ──────────────────────────────────────────────────────────────

  async listEducation(employeeId: string) {
    await this.findOne(employeeId);
    return this.educationRepo.find({ where: { employeeId }, order: { startYear: 'DESC' } });
  }

  async addEducation(employeeId: string, dto: CreateEducationDto) {
    await this.findOne(employeeId);
    return this.educationRepo.save(
      this.educationRepo.create({
        employeeId,
        degree: dto.degree,
        institution: dto.institution,
        fieldOfStudy: dto.fieldOfStudy ?? null,
        result: dto.result ?? null,
        startYear: dto.startYear ?? null,
        endYear: dto.endYear ?? null,
        note: dto.note ?? null,
      }),
    );
  }

  async updateEducation(employeeId: string, educationId: string, dto: UpdateEducationDto) {
    const record = await this.educationRepo.findOne({ where: { id: educationId, employeeId } });
    if (!record) throw new NotFoundException('Education record not found');
    Object.assign(record, {
      ...(dto.degree !== undefined && { degree: dto.degree }),
      ...(dto.institution !== undefined && { institution: dto.institution }),
      ...(dto.fieldOfStudy !== undefined && { fieldOfStudy: dto.fieldOfStudy }),
      ...(dto.result !== undefined && { result: dto.result }),
      ...(dto.startYear !== undefined && { startYear: dto.startYear }),
      ...(dto.endYear !== undefined && { endYear: dto.endYear }),
      ...(dto.note !== undefined && { note: dto.note }),
    });
    return this.educationRepo.save(record);
  }

  async deleteEducation(employeeId: string, educationId: string) {
    const record = await this.educationRepo.findOne({ where: { id: educationId, employeeId } });
    if (!record) throw new NotFoundException('Education record not found');
    await this.educationRepo.delete({ id: educationId });
  }

  // ── Previous employment ─────────────────────────────────────────────────────

  async listPreviousEmployment(employeeId: string) {
    await this.findOne(employeeId);
    return this.previousEmploymentRepo.find({ where: { employeeId }, order: { fromDate: 'DESC' } });
  }

  async addPreviousEmployment(employeeId: string, dto: CreatePreviousEmploymentDto) {
    await this.findOne(employeeId);
    return this.previousEmploymentRepo.save(
      this.previousEmploymentRepo.create({
        employeeId,
        companyName: dto.companyName,
        designation: dto.designation ?? null,
        fromDate: dto.fromDate,
        toDate: dto.toDate ?? null,
        reasonForLeaving: dto.reasonForLeaving ?? null,
        note: dto.note ?? null,
      }),
    );
  }

  async updatePreviousEmployment(employeeId: string, id: string, dto: UpdatePreviousEmploymentDto) {
    const record = await this.previousEmploymentRepo.findOne({ where: { id, employeeId } });
    if (!record) throw new NotFoundException('Previous employment record not found');
    Object.assign(record, {
      ...(dto.companyName !== undefined && { companyName: dto.companyName }),
      ...(dto.designation !== undefined && { designation: dto.designation }),
      ...(dto.fromDate !== undefined && { fromDate: dto.fromDate }),
      ...(dto.toDate !== undefined && { toDate: dto.toDate }),
      ...(dto.reasonForLeaving !== undefined && { reasonForLeaving: dto.reasonForLeaving }),
      ...(dto.note !== undefined && { note: dto.note }),
    });
    return this.previousEmploymentRepo.save(record);
  }

  async deletePreviousEmployment(employeeId: string, id: string) {
    const record = await this.previousEmploymentRepo.findOne({ where: { id, employeeId } });
    if (!record) throw new NotFoundException('Previous employment record not found');
    await this.previousEmploymentRepo.delete({ id });
  }

  private async generateCode(em: ReturnType<DataSource['createEntityManager']>): Promise<string> {
    const count = await em.count(Employee);
    return `EMP${String(count + 1).padStart(4, '0')}`;
  }
}
