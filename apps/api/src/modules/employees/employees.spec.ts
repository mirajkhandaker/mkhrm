import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Employee } from '../../database/entities/employees/employee.entity';
import { JobChange } from '../../database/entities/employees/job-change.entity';
import { ProbationRecord } from '../../database/entities/employees/probation-record.entity';
import { EmploymentStatusHistory } from '../../database/entities/employees/employment-status-history.entity';
import { Document } from '../../database/entities/employees/document.entity';
import { Education } from '../../database/entities/employees/education.entity';
import { PreviousEmployment } from '../../database/entities/employees/previous-employment.entity';
import { User } from '../../database/entities/auth/user.entity';
import { Role } from '../../database/entities/auth/role.entity';
import {
  EmploymentStatus,
  EmploymentType,
  ProbationStatus,
  DocumentType,
  EducationDegree,
} from '@hrm/types';

const mockEmp = {
  id: 'emp-1',
  employeeCode: 'EMP0001',
  firstName: 'John',
  lastName: 'Doe',
  userId: 'user-1',
  joinDate: '2024-01-01',
  employmentType: EmploymentType.Permanent,
  employmentStatus: EmploymentStatus.Probation,
  departmentId: 'dept-1',
  designationId: 'desig-1',
  lineManagerId: null,
};

const mockProbation = {
  id: 'prob-1',
  employeeId: 'emp-1',
  status: ProbationStatus.InProbation,
  startDate: '2024-01-01',
  probationMonths: 3,
  expectedConfirmationDate: '2024-04-01',
};

function makeRepo(entity: object) {
  return {
    findOne: jest.fn().mockResolvedValue(entity),
    find: jest.fn().mockResolvedValue([entity]),
    save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e) => e),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[entity], 1]),
      getMany: jest.fn().mockResolvedValue([entity]),
    }),
  };
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let empRepo: ReturnType<typeof makeRepo>;
  let probationRepo: ReturnType<typeof makeRepo>;
  let historyRepo: ReturnType<typeof makeRepo>;
  let documentRepo: ReturnType<typeof makeRepo>;
  let educationRepo: ReturnType<typeof makeRepo>;
  let previousEmploymentRepo: ReturnType<typeof makeRepo>;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    empRepo = makeRepo(mockEmp);
    probationRepo = makeRepo(mockProbation);
    historyRepo = makeRepo({});
    documentRepo = makeRepo({ id: 'doc-1', employeeId: 'emp-1', fileUrl: 'uploads/documents/x.png' });
    educationRepo = makeRepo({ id: 'edu-1', employeeId: 'emp-1' });
    previousEmploymentRepo = makeRepo({ id: 'prev-1', employeeId: 'emp-1' });

    mockDataSource = {
      transaction: jest.fn().mockImplementation((cb: (em: object) => Promise<unknown>) => {
        const em = {
          findOne: jest.fn().mockResolvedValue(mockEmp),
          findOneOrFail: jest.fn().mockResolvedValue(mockEmp),
          save: jest.fn().mockImplementation((_cls: unknown, e: unknown) => Promise.resolve(e)),
          create: jest.fn().mockImplementation((_cls: unknown, e: unknown) => e),
          update: jest.fn().mockResolvedValue({}),
          count: jest.fn().mockResolvedValue(0),
        };
        return cb(em);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getRepositoryToken(Employee), useValue: empRepo },
        { provide: getRepositoryToken(JobChange), useValue: makeRepo({}) },
        { provide: getRepositoryToken(ProbationRecord), useValue: probationRepo },
        { provide: getRepositoryToken(EmploymentStatusHistory), useValue: historyRepo },
        { provide: getRepositoryToken(Document), useValue: documentRepo },
        { provide: getRepositoryToken(Education), useValue: educationRepo },
        { provide: getRepositoryToken(PreviousEmployment), useValue: previousEmploymentRepo },
        { provide: getRepositoryToken(User), useValue: makeRepo({}) },
        { provide: getRepositoryToken(Role), useValue: makeRepo({}) },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  it('findOne throws NotFoundException when not found', async () => {
    empRepo.findOne.mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('applyJobChange writes job_change and updates employee fields', async () => {
    const result = await service.applyJobChange(
      'emp-1',
      {
        type: 'promotion' as never,
        effectiveDate: '2024-06-01',
        toDesignationId: 'desig-2',
      },
      'actor-1',
    );
    expect(mockDataSource.transaction).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('probationAction confirms employee and writes status history', async () => {
    await service.probationAction('emp-1', { action: ProbationStatus.Confirmed }, 'actor-1');
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });

  it('probationAction extended requires extendedTo', async () => {
    await expect(
      service.probationAction('emp-1', { action: ProbationStatus.Extended }, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('probationAction throws when no active probation', async () => {
    probationRepo.findOne.mockResolvedValue(null);
    await expect(
      service.probationAction('emp-1', { action: ProbationStatus.Confirmed }, 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });

  describe('documents', () => {
    const fakeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'id-card.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake'),
      ...overrides,
    } as Express.Multer.File);

    it('addDocument rejects disallowed mime types', async () => {
      await expect(
        service.addDocument('emp-1', { type: DocumentType.NID }, fakeFile({ mimetype: 'application/zip' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('addDocument rejects files over 5MB', async () => {
      await expect(
        service.addDocument('emp-1', { type: DocumentType.NID }, fakeFile({ size: 6 * 1024 * 1024 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('addDocument saves a document row with fileName/mimeType/fileSizeBytes', async () => {
      const result = await service.addDocument('emp-1', { type: DocumentType.NID }, fakeFile());
      expect(documentRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        employeeId: 'emp-1',
        type: DocumentType.NID,
        fileName: 'id-card.png',
        mimeType: 'image/png',
        fileSizeBytes: 1024,
      });
    });

    it('deleteDocument throws NotFoundException for a document belonging to a different employee', async () => {
      documentRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteDocument('emp-1', 'doc-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('education', () => {
    it('addEducation saves an education row for the employee', async () => {
      const result = await service.addEducation('emp-1', {
        degree: EducationDegree.Bachelors,
        institution: 'University of Dhaka',
      });
      expect(educationRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ employeeId: 'emp-1', degree: EducationDegree.Bachelors });
    });

    it('listEducation throws NotFoundException when employee does not exist', async () => {
      empRepo.findOne.mockResolvedValue(null);
      await expect(service.listEducation('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('deleteEducation removes the record', async () => {
      await service.deleteEducation('emp-1', 'edu-1');
      expect(educationRepo.delete).toHaveBeenCalledWith({ id: 'edu-1' });
    });

    it('deleteEducation throws NotFoundException for a record belonging to a different employee', async () => {
      educationRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteEducation('emp-1', 'edu-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('previousEmployment', () => {
    it('addPreviousEmployment saves a record for the employee', async () => {
      const result = await service.addPreviousEmployment('emp-1', {
        companyName: 'BrightSoft Ltd.',
        fromDate: '2020-07-01',
      });
      expect(previousEmploymentRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ employeeId: 'emp-1', companyName: 'BrightSoft Ltd.' });
    });

    it('deletePreviousEmployment removes the record', async () => {
      await service.deletePreviousEmployment('emp-1', 'prev-1');
      expect(previousEmploymentRepo.delete).toHaveBeenCalledWith({ id: 'prev-1' });
    });
  });
});
