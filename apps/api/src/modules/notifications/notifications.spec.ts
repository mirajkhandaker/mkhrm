import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import {
  ApprovalEntityType,
  ApprovalAction,
  ApproverType,
  NotificationType,
} from '@hrm/types';
import { NotificationsService } from './notifications.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { Notification } from '../../database/entities/system/notification.entity';
import { User } from '../../database/entities/auth/user.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Workflow } from '../../database/entities/approvals/workflow.entity';
import { WorkflowStep } from '../../database/entities/approvals/workflow-step.entity';
import { Approval } from '../../database/entities/approvals/approval.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';
import { Role } from '../../database/entities/auth/role.entity';

// Exercises NotificationsService wired to the real ApprovalsService through a genuine
// EventEmitter2 — verifies "emit on submit/approve/reject" actually produces notification rows.

const REQUESTER = { id: 'emp-req', userId: 'user-emp', lineManagerId: 'emp-mgr', departmentId: 'dept-1' };
const MANAGER = { id: 'emp-mgr', userId: 'user-mgr', lineManagerId: null, departmentId: 'dept-1' };

const STEP_MANAGER: WorkflowStep = {
  id: 'step-1', workflowId: 'wf-1', workflow: null as never, stepOrder: 1,
  approverType: ApproverType.LineManager, approverRef: null, isMandatory: true, slaHours: 24,
  minMetricValue: null, maxMetricValue: null, createdAt: new Date(),
};

const WORKFLOW: Workflow = {
  id: 'wf-1', name: 'Requisition Approval', entityType: ApprovalEntityType.Requisition,
  isActive: true, createdAt: new Date(), updatedAt: new Date(), steps: [STEP_MANAGER],
};

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(0),
  };
}

async function buildContext() {
  const notificationRepo = makeRepo();
  const userRepo = makeRepo();
  userRepo.findOne = jest.fn().mockImplementation((opts: { where: { id: string } }) =>
    Promise.resolve({ id: opts.where.id, email: `${opts.where.id}@hrm.local` }));

  const employeeRepo = makeRepo();
  employeeRepo.findOne = jest.fn().mockImplementation((opts: { where: { userId?: string; id?: string } }) => {
    const { userId, id } = opts.where;
    if (userId === 'user-emp' || id === 'emp-req') return Promise.resolve(REQUESTER);
    if (userId === 'user-mgr' || id === 'emp-mgr') return Promise.resolve(MANAGER);
    return Promise.resolve(null);
  });

  const workflowRepo = makeRepo();
  workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW);

  let savedApproval: Approval | null = null;
  const approvalRepo = makeRepo();
  approvalRepo.create = jest.fn().mockImplementation((e: Partial<Approval>) => ({ id: 'appr-1', actions: [], ...e }));
  approvalRepo.save = jest.fn().mockImplementation((a: Approval) => { savedApproval = a; return Promise.resolve(a); });
  approvalRepo.findOne = jest.fn().mockImplementation(() => Promise.resolve(savedApproval));

  const dataSource = { getRepository: jest.fn(), transaction: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot()],
    providers: [
      NotificationsService,
      ApprovalsService,
      { provide: getRepositoryToken(Notification), useValue: notificationRepo },
      { provide: getRepositoryToken(User), useValue: userRepo },
      { provide: getRepositoryToken(Employee), useValue: employeeRepo },
      { provide: getRepositoryToken(Department), useValue: makeRepo() },
      { provide: getRepositoryToken(Workflow), useValue: workflowRepo },
      { provide: getRepositoryToken(WorkflowStep), useValue: makeRepo() },
      { provide: getRepositoryToken(Approval), useValue: approvalRepo },
      { provide: getRepositoryToken(ApprovalActionRecord), useValue: makeRepo() },
      { provide: getRepositoryToken(Role), useValue: makeRepo() },
      { provide: DataSource, useValue: dataSource },
    ],
  }).compile();

  await module.init();

  return { approvalsSvc: module.get(ApprovalsService), notificationRepo };
}

describe('Notifications — approval lifecycle events', () => {
  it('notifies the approver when a request is submitted', async () => {
    const { approvalsSvc, notificationRepo } = await buildContext();

    await approvalsSvc.start({
      entityType: ApprovalEntityType.Requisition,
      entityId: 'req-1',
      requesterId: 'user-emp',
    });

    expect(notificationRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-mgr',
      type: NotificationType.ApprovalRequested,
      link: '/approvals',
    }));
  });

  it('notifies the requester when their request is approved', async () => {
    const { approvalsSvc, notificationRepo } = await buildContext();
    await approvalsSvc.start({ entityType: ApprovalEntityType.Requisition, entityId: 'req-1', requesterId: 'user-emp' });
    notificationRepo.save.mockClear();

    await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Approve });

    expect(notificationRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-emp',
      type: NotificationType.ApprovalApproved,
      link: '/requisitions/req-1',
    }));
  });

  it('notifies the requester when their request is rejected', async () => {
    const { approvalsSvc, notificationRepo } = await buildContext();
    await approvalsSvc.start({ entityType: ApprovalEntityType.Requisition, entityId: 'req-1', requesterId: 'user-emp' });
    notificationRepo.save.mockClear();

    await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Reject, comment: 'No budget' });

    expect(notificationRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-emp',
      type: NotificationType.ApprovalRejected,
    }));
  });

  it('notifies the requester when their request is returned for changes', async () => {
    const { approvalsSvc, notificationRepo } = await buildContext();
    await approvalsSvc.start({ entityType: ApprovalEntityType.Requisition, entityId: 'req-1', requesterId: 'user-emp' });
    notificationRepo.save.mockClear();

    await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Return, comment: 'Add more detail' });

    expect(notificationRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-emp',
      type: NotificationType.System,
    }));
  });
});
