import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AttachmentOwnerType } from '@hrm/types';
import { AttachmentsService } from './attachments.service';
import { Attachment } from '../../database/entities/system/attachment.entity';
import { TravelRequestItem } from '../../database/entities/travel/travel-request-item.entity';
import { ExpenseItem } from '../../database/entities/travel/expense-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

async function buildContext() {
  const attachmentRepo = makeRepo();
  const travelItemRepo = makeRepo();
  const expenseItemRepo = makeRepo();
  const employeeRepo = makeRepo();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AttachmentsService,
      { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
      { provide: getRepositoryToken(TravelRequestItem), useValue: travelItemRepo },
      { provide: getRepositoryToken(ExpenseItem), useValue: expenseItemRepo },
      { provide: getRepositoryToken(Employee), useValue: employeeRepo },
    ],
  }).compile();

  return {
    svc: module.get(AttachmentsService),
    attachmentRepo,
    travelItemRepo,
    expenseItemRepo,
    employeeRepo,
  };
}

describe('AttachmentsService — file validation', () => {
  it('rejects a disallowed mime type', async () => {
    const { svc } = await buildContext();
    expect(() => svc.stageFile({ mimetype: 'application/zip', size: 100 } as Express.Multer.File))
      .toThrow(BadRequestException);
  });

  it('rejects a file over 5MB', async () => {
    const { svc } = await buildContext();
    expect(() => svc.stageFile({ mimetype: 'image/png', size: 6 * 1024 * 1024 } as Express.Multer.File))
      .toThrow(BadRequestException);
  });
});

describe('AttachmentsService — access control', () => {
  it('allows the owning employee to access their own expense-item attachment', async () => {
    const { svc, attachmentRepo, expenseItemRepo, employeeRepo } = await buildContext();
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1', ownerType: AttachmentOwnerType.ExpenseItem, ownerId: 'item-1',
    });
    expenseItemRepo.findOne.mockResolvedValue({ id: 'item-1', expenseClaim: { employeeId: 'emp-req' } });
    employeeRepo.findOne.mockResolvedValue({ id: 'emp-req', userId: 'user-emp' });

    const attachment = await svc.getById('att-1');
    await expect(svc.assertAccess(attachment, 'user-emp', false)).resolves.toBeUndefined();
  });

  it('refuses access to an attachment on someone else\'s claim', async () => {
    const { svc, attachmentRepo, expenseItemRepo, employeeRepo } = await buildContext();
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1', ownerType: AttachmentOwnerType.ExpenseItem, ownerId: 'item-1',
    });
    expenseItemRepo.findOne.mockResolvedValue({ id: 'item-1', expenseClaim: { employeeId: 'emp-req' } });
    employeeRepo.findOne.mockResolvedValue({ id: 'emp-other', userId: 'user-other' });

    const attachment = await svc.getById('att-1');
    await expect(svc.assertAccess(attachment, 'user-other', false)).rejects.toThrow(ForbiddenException);
  });

  it('lets a caller with an approve/reimburse/settle permission bypass ownership without a lookup', async () => {
    const { svc, attachmentRepo, expenseItemRepo } = await buildContext();
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1', ownerType: AttachmentOwnerType.ExpenseItem, ownerId: 'item-1',
    });

    const attachment = await svc.getById('att-1');
    await expect(svc.assertAccess(attachment, 'user-finance', true)).resolves.toBeUndefined();
    expect(expenseItemRepo.findOne).not.toHaveBeenCalled();
  });

  it('resolves ownership through a travel-request-item owner too', async () => {
    const { svc, attachmentRepo, travelItemRepo, employeeRepo } = await buildContext();
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-2', ownerType: AttachmentOwnerType.TravelRequestItem, ownerId: 'leg-1',
    });
    travelItemRepo.findOne.mockResolvedValue({ id: 'leg-1', travelRequest: { employeeId: 'emp-req' } });
    employeeRepo.findOne.mockResolvedValue({ id: 'emp-req', userId: 'user-emp' });

    const attachment = await svc.getById('att-2');
    await expect(svc.assertAccess(attachment, 'user-emp', false)).resolves.toBeUndefined();
  });

  it('throws NotFoundException for an unknown attachment id', async () => {
    const { svc } = await buildContext();
    await expect(svc.getById('missing')).rejects.toThrow(NotFoundException);
  });
});
