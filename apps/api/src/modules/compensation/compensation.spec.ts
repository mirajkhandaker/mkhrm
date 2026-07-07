import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalaryCalculatorService } from './salary-calculator.service';
import { CompensationService } from './compensation.service';
import { SalaryComponent } from '../../database/entities/compensation/salary-component.entity';
import { SalaryGrade } from '../../database/entities/compensation/salary-grade.entity';
import { EmployeeSalaryStructure } from '../../database/entities/compensation/employee-salary-structure.entity';
import { SalaryStructureLine } from '../../database/entities/compensation/salary-structure-line.entity';
import { PfAccount } from '../../database/entities/compensation/pf-account.entity';
import { EmployeeBenefit } from '../../database/entities/compensation/employee-benefit.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import {
  SalaryComponentType,
  SalaryCalcType,
  InputBasis,
  PfBase,
  PfStatus,
  Permission,
} from '@hrm/types';

function makeComponent(
  overrides: Partial<SalaryComponent> & {
    type: SalaryComponentType;
    calcType: SalaryCalcType;
  },
): SalaryComponent {
  return {
    id: overrides.id ?? 'comp-' + Math.random(),
    name: overrides.name ?? 'Component',
    code: overrides.code ?? 'CODE',
    type: overrides.type,
    calcType: overrides.calcType,
    defaultValue: overrides.defaultValue ?? null,
    isPfApplicable: false,
    isTaxable: false,
    displayOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SalaryComponent;
}

function makePf(overrides: Partial<PfAccount> = {}): PfAccount {
  return {
    id: 'pf-1',
    employeeId: 'emp-1',
    pfNumber: null,
    enrolledOn: '2024-01-01',
    employeeContribPercent: '10',
    employerContribPercent: '10',
    pfBase: PfBase.Basic,
    status: PfStatus.Active,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PfAccount;
}

describe('SalaryCalculatorService', () => {
  let calculator: SalaryCalculatorService;

  beforeEach(() => {
    calculator = new SalaryCalculatorService();
  });

  // Basic salary component fixtures
  const basicComponent = makeComponent({
    id: 'basic',
    name: 'Basic',
    code: 'BASIC',
    type: SalaryComponentType.Earning,
    calcType: SalaryCalcType.Remainder,
  });

  const hraComponent = makeComponent({
    id: 'hra',
    name: 'HRA',
    code: 'HRA',
    type: SalaryComponentType.Earning,
    calcType: SalaryCalcType.PercentOfBasic,
  });

  const transportComponent = makeComponent({
    id: 'transport',
    name: 'Transport',
    code: 'TRANSPORT',
    type: SalaryComponentType.Earning,
    calcType: SalaryCalcType.Fixed,
  });

  const deductionComponent = makeComponent({
    id: 'deduct',
    name: 'Tax Deduction',
    code: 'TAX',
    type: SalaryComponentType.Deduction,
    calcType: SalaryCalcType.PercentOfGross,
  });

  describe('basic-input path', () => {
    it('calculates gross correctly from basic + percent_of_basic + fixed allowances', () => {
      const result = calculator.calculate({
        inputBasis: InputBasis.Basic,
        inputAmount: 50000,
        lines: [
          { component: basicComponent, inputValue: null },      // remainder = basic
          { component: hraComponent, inputValue: 40 },          // 40% of 50000 = 20000
          { component: transportComponent, inputValue: 5000 },  // fixed 5000
        ],
        pfAccount: null,
        basicToGrossMinRatio: 0.5,
      });

      expect(result.basicAmount).toBe(50000);
      expect(result.grossAmount).toBe(75000); // 50000 + 20000 + 5000
      expect(result.netAmount).toBe(75000);   // no deductions
      expect(result.employeePf).toBe(0);
    });

    it('includes deductions in net calculation', () => {
      const result = calculator.calculate({
        inputBasis: InputBasis.Basic,
        inputAmount: 50000,
        lines: [
          { component: basicComponent, inputValue: null },
          { component: hraComponent, inputValue: 40 },      // 20000
          { component: deductionComponent, inputValue: 5 }, // 5% of 70000 gross = 3500
        ],
        pfAccount: null,
        basicToGrossMinRatio: 0.5,
      });

      expect(result.basicAmount).toBe(50000);
      expect(result.grossAmount).toBe(70000); // 50000 + 20000
      expect(result.netAmount).toBe(66500);   // 70000 - 3500
    });
  });

  describe('gross-input path', () => {
    it('computes basic as remainder from gross minus other earnings', () => {
      const grossComponent = makeComponent({
        id: 'gross-hra',
        name: 'HRA',
        code: 'HRA2',
        type: SalaryComponentType.Earning,
        calcType: SalaryCalcType.PercentOfGross,
      });

      const result = calculator.calculate({
        inputBasis: InputBasis.Gross,
        inputAmount: 100000,
        lines: [
          { component: basicComponent, inputValue: null },   // remainder
          { component: grossComponent, inputValue: 30 },     // 30% of 100000 = 30000
          { component: transportComponent, inputValue: 5000 }, // fixed
        ],
        pfAccount: null,
        basicToGrossMinRatio: 0.5,
      });

      expect(result.grossAmount).toBe(100000);
      expect(result.basicAmount).toBe(65000); // 100000 - 30000 - 5000
      expect(result.netAmount).toBe(100000);
    });

    it('rejects when basic-to-gross ratio is violated', () => {
      const grossComponent = makeComponent({
        id: 'hra-gross',
        name: 'HRA',
        code: 'HRA3',
        type: SalaryComponentType.Earning,
        calcType: SalaryCalcType.PercentOfGross,
      });

      expect(() =>
        calculator.calculate({
          inputBasis: InputBasis.Gross,
          inputAmount: 100000,
          lines: [
            { component: basicComponent, inputValue: null },
            { component: grossComponent, inputValue: 60 }, // 60000; basic = 40000 < 50%
          ],
          pfAccount: null,
          basicToGrossMinRatio: 0.5,
        }),
      ).toThrow(BadRequestException);
    });

    it('passes when basic exactly meets the minimum ratio', () => {
      const grossComponent = makeComponent({
        id: 'hra-exact',
        name: 'HRA',
        code: 'HRA4',
        type: SalaryComponentType.Earning,
        calcType: SalaryCalcType.PercentOfGross,
      });

      const result = calculator.calculate({
        inputBasis: InputBasis.Gross,
        inputAmount: 100000,
        lines: [
          { component: basicComponent, inputValue: null },
          { component: grossComponent, inputValue: 50 }, // basic = 50000 = exactly 50%
        ],
        pfAccount: null,
        basicToGrossMinRatio: 0.5,
      });

      expect(result.basicAmount).toBe(50000);
    });
  });

  describe('PF computation', () => {
    it('deducts employee PF from net and adds employer PF to CTC', () => {
      const result = calculator.calculate({
        inputBasis: InputBasis.Basic,
        inputAmount: 50000,
        lines: [
          { component: basicComponent, inputValue: null },
          { component: hraComponent, inputValue: 40 }, // gross = 70000
        ],
        pfAccount: makePf({ pfBase: PfBase.Basic }),
        basicToGrossMinRatio: 0.5,
      });

      // PF base = basic = 50000; employee 10% = 5000; employer 10% = 5000
      expect(result.employeePf).toBe(5000);
      expect(result.employerPf).toBe(5000);
      expect(result.netAmount).toBe(65000);  // 70000 - 5000
      expect(result.ctcAmount).toBe(75000);  // 70000 + 5000
    });

    it('computes PF on gross when pfBase = gross', () => {
      const result = calculator.calculate({
        inputBasis: InputBasis.Basic,
        inputAmount: 50000,
        lines: [
          { component: basicComponent, inputValue: null },
          { component: hraComponent, inputValue: 40 }, // gross = 70000
        ],
        pfAccount: makePf({ pfBase: PfBase.Gross }),
        basicToGrossMinRatio: 0.5,
      });

      // PF base = gross = 70000; employee 10% = 7000; employer 10% = 7000
      expect(result.employeePf).toBe(7000);
      expect(result.employerPf).toBe(7000);
    });

    it('skips PF when account status is stopped', () => {
      const result = calculator.calculate({
        inputBasis: InputBasis.Basic,
        inputAmount: 50000,
        lines: [{ component: basicComponent, inputValue: null }],
        pfAccount: makePf({ status: PfStatus.Stopped }),
        basicToGrossMinRatio: 0.5,
      });

      expect(result.employeePf).toBe(0);
      expect(result.employerPf).toBe(0);
    });
  });

  describe('mixed earning and deduction components', () => {
    it('handles a full structure with earnings, fixed deduction, and PF', () => {
      const incomeTax = makeComponent({
        id: 'itax',
        name: 'Income Tax',
        code: 'ITAX',
        type: SalaryComponentType.Deduction,
        calcType: SalaryCalcType.Fixed,
      });

      const result = calculator.calculate({
        inputBasis: InputBasis.Basic,
        inputAmount: 50000,
        lines: [
          { component: basicComponent, inputValue: null },
          { component: hraComponent, inputValue: 40 },      // +20000, gross = 70000
          { component: deductionComponent, inputValue: 5 }, // 5% of 70000 = 3500
          { component: incomeTax, inputValue: 2000 },       // fixed 2000
        ],
        pfAccount: makePf({ pfBase: PfBase.Basic }),
        basicToGrossMinRatio: 0.5,
      });

      expect(result.grossAmount).toBe(70000);
      expect(result.employeePf).toBe(5000);
      // net = 70000 - 3500 - 2000 - 5000
      expect(result.netAmount).toBe(59500);
      expect(result.ctcAmount).toBe(75000); // 70000 + 5000 employer PF
      expect(result.lines).toHaveLength(4);
    });
  });
});

describe('CompensationService — allow_self_salary_view enforcement', () => {
  let service: CompensationService;
  let structureRepo: { findOne: jest.Mock; find: jest.Mock };
  let employeeRepo: { findOne: jest.Mock };
  let settingsRepo: { findOneBy: jest.Mock };

  function makeRepo() {
    return { findOne: jest.fn(), find: jest.fn() };
  }

  async function buildService(allowSelfView: boolean) {
    structureRepo = { findOne: jest.fn().mockResolvedValue({ id: 'structure-1' }), find: jest.fn().mockResolvedValue([]) };
    employeeRepo = { findOne: jest.fn().mockResolvedValue({ id: 'emp-self', userId: 'user-self' }) };
    settingsRepo = { findOneBy: jest.fn().mockResolvedValue({ key: 'allow_self_salary_view', value: allowSelfView }) };

    const dataSource = { getRepository: jest.fn().mockReturnValue(settingsRepo) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompensationService,
        SalaryCalculatorService,
        { provide: getRepositoryToken(SalaryComponent), useValue: makeRepo() },
        { provide: getRepositoryToken(SalaryGrade), useValue: makeRepo() },
        { provide: getRepositoryToken(EmployeeSalaryStructure), useValue: structureRepo },
        { provide: getRepositoryToken(SalaryStructureLine), useValue: makeRepo() },
        { provide: getRepositoryToken(PfAccount), useValue: makeRepo() },
        { provide: getRepositoryToken(EmployeeBenefit), useValue: makeRepo() },
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(CompensationService);
  }

  it('allows a caller with SalaryView regardless of the setting or whose record it is', async () => {
    await buildService(false);
    await expect(
      service.getCurrentStructure('emp-other', 'user-hr', [Permission.SalaryView]),
    ).resolves.toBeDefined();
  });

  it('denies self-view when allow_self_salary_view is false', async () => {
    await buildService(false);
    await expect(
      service.getCurrentStructure('emp-self', 'user-self', []),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows self-view when allow_self_salary_view is true and the ids match', async () => {
    await buildService(true);
    await expect(
      service.getCurrentStructure('emp-self', 'user-self', []),
    ).resolves.toBeDefined();
  });

  it('denies viewing a colleague\'s salary even when allow_self_salary_view is true', async () => {
    await buildService(true);
    await expect(
      service.getCurrentStructure('emp-someone-else', 'user-self', []),
    ).rejects.toThrow(ForbiddenException);
  });
});
