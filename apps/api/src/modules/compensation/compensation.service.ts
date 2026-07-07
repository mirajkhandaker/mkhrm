import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SalaryComponent } from '../../database/entities/compensation/salary-component.entity';
import { SalaryGrade } from '../../database/entities/compensation/salary-grade.entity';
import { EmployeeSalaryStructure } from '../../database/entities/compensation/employee-salary-structure.entity';
import { SalaryStructureLine } from '../../database/entities/compensation/salary-structure-line.entity';
import { PfAccount } from '../../database/entities/compensation/pf-account.entity';
import { EmployeeBenefit } from '../../database/entities/compensation/employee-benefit.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { SalaryCalculatorService } from './salary-calculator.service';
import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { UpdateSalaryComponentDto } from './dto/update-salary-component.dto';
import { CreateSalaryGradeDto } from './dto/create-salary-grade.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { CreatePfAccountDto, UpdatePfAccountDto } from './dto/create-pf-account.dto';
import { CreateBenefitDto, UpdateBenefitDto } from './dto/create-benefit.dto';
import { SalaryStructureStatus, Permission } from '@hrm/types';

@Injectable()
export class CompensationService {
  constructor(
    @InjectRepository(SalaryComponent) private componentRepo: Repository<SalaryComponent>,
    @InjectRepository(SalaryGrade) private gradeRepo: Repository<SalaryGrade>,
    @InjectRepository(EmployeeSalaryStructure) private structureRepo: Repository<EmployeeSalaryStructure>,
    @InjectRepository(SalaryStructureLine) private lineRepo: Repository<SalaryStructureLine>,
    @InjectRepository(PfAccount) private pfRepo: Repository<PfAccount>,
    @InjectRepository(EmployeeBenefit) private benefitRepo: Repository<EmployeeBenefit>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private calculator: SalaryCalculatorService,
    private dataSource: DataSource,
  ) {}

  // ── Self-view access control ────────────────────────────────────────────────

  private async assertSalaryAccess(
    employeeId: string,
    requesterUserId: string,
    requesterPermissions: string[],
  ): Promise<void> {
    if (
      requesterPermissions.includes(Permission.SalaryView)
      || requesterPermissions.includes(Permission.SalaryManage)
    ) {
      return;
    }

    const settingsRepo = this.dataSource.getRepository('settings');
    const allowSetting = await settingsRepo.findOneBy({ key: 'allow_self_salary_view' });
    if (allowSetting?.value !== true) {
      throw new ForbiddenException('You do not have access to salary information');
    }

    const employee = await this.employeeRepo.findOne({ where: { userId: requesterUserId } });
    if (!employee || employee.id !== employeeId) {
      throw new ForbiddenException('You do not have access to salary information');
    }
  }

  // ── Salary Components ───────────────────────────────────────────────────────

  findAllComponents() {
    return this.componentRepo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  async findOneComponent(id: string) {
    const c = await this.componentRepo.findOneBy({ id });
    if (!c) throw new NotFoundException(`Salary component ${id} not found`);
    return c;
  }

  async createComponent(dto: CreateSalaryComponentDto) {
    const existing = await this.componentRepo.findOneBy({ code: dto.code });
    if (existing) throw new ConflictException(`Component code "${dto.code}" already exists`);

    const component = this.componentRepo.create({
      name: dto.name,
      code: dto.code,
      type: dto.type,
      calcType: dto.calcType,
      defaultValue: dto.defaultValue != null ? String(dto.defaultValue) : null,
      isPfApplicable: dto.isPfApplicable ?? false,
      isTaxable: dto.isTaxable ?? false,
      displayOrder: dto.displayOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.componentRepo.save(component);
  }

  async updateComponent(id: string, dto: UpdateSalaryComponentDto) {
    const component = await this.findOneComponent(id);
    if (dto.code && dto.code !== component.code) {
      const existing = await this.componentRepo.findOneBy({ code: dto.code });
      if (existing) throw new ConflictException(`Component code "${dto.code}" already exists`);
    }
    Object.assign(component, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.calcType !== undefined && { calcType: dto.calcType }),
      ...(dto.defaultValue !== undefined && { defaultValue: String(dto.defaultValue) }),
      ...(dto.isPfApplicable !== undefined && { isPfApplicable: dto.isPfApplicable }),
      ...(dto.isTaxable !== undefined && { isTaxable: dto.isTaxable }),
      ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.componentRepo.save(component);
  }

  async deleteComponent(id: string) {
    const component = await this.findOneComponent(id);
    await this.componentRepo.remove(component);
  }

  // ── Salary Grades ───────────────────────────────────────────────────────────

  findAllGrades() {
    return this.gradeRepo.find({ order: { name: 'ASC' } });
  }

  async findOneGrade(id: string) {
    const g = await this.gradeRepo.findOneBy({ id });
    if (!g) throw new NotFoundException(`Salary grade ${id} not found`);
    return g;
  }

  async createGrade(dto: CreateSalaryGradeDto) {
    const grade = this.gradeRepo.create(dto);
    return this.gradeRepo.save(grade);
  }

  async updateGrade(id: string, dto: Partial<CreateSalaryGradeDto>) {
    const grade = await this.findOneGrade(id);
    Object.assign(grade, dto);
    return this.gradeRepo.save(grade);
  }

  async deleteGrade(id: string) {
    const grade = await this.findOneGrade(id);
    await this.gradeRepo.remove(grade);
  }

  // ── Salary Structures ───────────────────────────────────────────────────────

  async getCurrentStructure(
    employeeId: string,
    requesterUserId: string,
    requesterPermissions: string[],
  ) {
    await this.assertSalaryAccess(employeeId, requesterUserId, requesterPermissions);
    return this.structureRepo.findOne({
      where: { employeeId, status: SalaryStructureStatus.Active },
      order: { effectiveFrom: 'DESC' },
    });
  }

  async getSalaryHistory(
    employeeId: string,
    requesterUserId: string,
    requesterPermissions: string[],
  ) {
    await this.assertSalaryAccess(employeeId, requesterUserId, requesterPermissions);
    return this.structureRepo.find({
      where: { employeeId },
      order: { effectiveFrom: 'DESC' },
    });
  }

  async createSalaryStructure(
    employeeId: string,
    dto: CreateSalaryStructureDto,
    createdBy: string,
  ) {
    const componentIds = dto.lines.map((l) => l.componentId);
    if (componentIds.length === 0) {
      throw new BadRequestException('At least one salary line is required');
    }

    const components = await this.componentRepo.findBy(
      componentIds.map((id) => ({ id })),
    );
    if (components.length !== componentIds.length) {
      throw new BadRequestException('One or more component IDs are invalid');
    }

    const pfAccount = await this.pfRepo.findOneBy({ employeeId });

    // Read settings ratio
    const settingsRepo = this.dataSource.getRepository('settings');
    const ratioSetting = await settingsRepo.findOneBy({ key: 'basic_to_gross_min_ratio' });
    const ratio: number = ratioSetting?.value ?? 0.5;

    const lineInputs = dto.lines.map((l) => ({
      component: components.find((c) => c.id === l.componentId)!,
      inputValue: l.inputValue ?? null,
    }));

    const result = this.calculator.calculate({
      inputBasis: dto.inputBasis,
      inputAmount: dto.inputAmount,
      lines: lineInputs,
      pfAccount: pfAccount ?? null,
      basicToGrossMinRatio: ratio,
    });

    return this.dataSource.transaction(async (em) => {
      // Supersede current active structure
      await em.update(
        EmployeeSalaryStructure,
        { employeeId, status: SalaryStructureStatus.Active },
        { status: SalaryStructureStatus.Superseded, effectiveTo: dto.effectiveFrom },
      );

      const structure = em.create(EmployeeSalaryStructure, {
        employeeId,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: null,
        inputBasis: dto.inputBasis,
        inputAmount: String(dto.inputAmount),
        basicAmount: String(result.basicAmount),
        grossAmount: String(result.grossAmount),
        ctcAmount: String(result.ctcAmount),
        currency: dto.currency ?? 'BDT',
        reason: dto.reason,
        status: SalaryStructureStatus.Active,
        createdBy,
      });
      const saved = await em.save(EmployeeSalaryStructure, structure);

      const lineEntities = result.lines.map((rl) =>
        em.create(SalaryStructureLine, {
          salaryStructureId: saved.id,
          componentId: rl.component.id,
          calcType: rl.calcType,
          inputValue: rl.inputValue != null ? String(rl.inputValue) : null,
          computedAmount: String(rl.computedAmount),
        }),
      );
      await em.save(SalaryStructureLine, lineEntities);

      return { ...saved, lines: lineEntities, calculationResult: result };
    });
  }

  async previewSalary(
    dto: CreateSalaryStructureDto,
    employeeId: string | null,
  ) {
    const componentIds = dto.lines.map((l) => l.componentId);
    const components = await this.componentRepo.findBy(
      componentIds.map((id) => ({ id })),
    );

    const pfAccount = employeeId
      ? await this.pfRepo.findOneBy({ employeeId })
      : null;

    const settingsRepo = this.dataSource.getRepository('settings');
    const ratioSetting = await settingsRepo.findOneBy({ key: 'basic_to_gross_min_ratio' });
    const ratio: number = ratioSetting?.value ?? 0.5;

    const lineInputs = dto.lines.map((l) => ({
      component: components.find((c) => c.id === l.componentId)!,
      inputValue: l.inputValue ?? null,
    }));

    return this.calculator.calculate({
      inputBasis: dto.inputBasis,
      inputAmount: dto.inputAmount,
      lines: lineInputs,
      pfAccount: pfAccount ?? null,
      basicToGrossMinRatio: ratio,
    });
  }

  // ── PF Accounts ─────────────────────────────────────────────────────────────

  async getPfAccount(employeeId: string) {
    return this.pfRepo.findOneBy({ employeeId });
  }

  async createPfAccount(employeeId: string, dto: CreatePfAccountDto) {
    const existing = await this.pfRepo.findOneBy({ employeeId });
    if (existing) throw new ConflictException('PF account already exists for this employee');

    const account = this.pfRepo.create({
      employeeId,
      pfNumber: dto.pfNumber ?? null,
      enrolledOn: dto.enrolledOn,
      employeeContribPercent: String(dto.employeeContribPercent ?? 10),
      employerContribPercent: String(dto.employerContribPercent ?? 10),
      pfBase: dto.pfBase,
      status: dto.status,
    });
    return this.pfRepo.save(account);
  }

  async updatePfAccount(employeeId: string, id: string, dto: UpdatePfAccountDto) {
    const account = await this.pfRepo.findOne({ where: { id, employeeId } });
    if (!account) throw new NotFoundException('PF account not found');
    Object.assign(account, {
      ...(dto.pfNumber !== undefined && { pfNumber: dto.pfNumber }),
      ...(dto.employeeContribPercent !== undefined && {
        employeeContribPercent: String(dto.employeeContribPercent),
      }),
      ...(dto.employerContribPercent !== undefined && {
        employerContribPercent: String(dto.employerContribPercent),
      }),
      ...(dto.pfBase !== undefined && { pfBase: dto.pfBase }),
      ...(dto.status !== undefined && { status: dto.status }),
    });
    return this.pfRepo.save(account);
  }

  // ── Employee Benefits ───────────────────────────────────────────────────────

  getBenefits(employeeId: string) {
    return this.benefitRepo.find({
      where: { employeeId },
      order: { effectiveFrom: 'DESC' },
    });
  }

  async createBenefit(employeeId: string, dto: CreateBenefitDto) {
    const benefit = this.benefitRepo.create({ employeeId, ...dto });
    return this.benefitRepo.save(benefit);
  }

  async updateBenefit(employeeId: string, id: string, dto: UpdateBenefitDto) {
    const benefit = await this.benefitRepo.findOne({ where: { id, employeeId } });
    if (!benefit) throw new NotFoundException('Benefit not found');
    Object.assign(benefit, dto);
    return this.benefitRepo.save(benefit);
  }

  async deleteBenefit(employeeId: string, id: string) {
    const benefit = await this.benefitRepo.findOne({ where: { id, employeeId } });
    if (!benefit) throw new NotFoundException('Benefit not found');
    await this.benefitRepo.remove(benefit);
  }
}
