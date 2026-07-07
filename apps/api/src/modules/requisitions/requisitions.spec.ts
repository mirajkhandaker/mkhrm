import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import {
  ApprovalEntityType,
  ApprovalStatus,
  ApprovalAction,
  ApproverType,
  RequisitionStatus,
  RequisitionType,
  RequisitionPriority,
} from '@hrm/types';
import { RequisitionsService } from './requisitions.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { Requisition } from '../../database/entities/requisitions/requisition.entity';
import { RequisitionItem } from '../../database/entities/requisitions/requisition-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Role } from '../../database/entities/auth/role.entity';
import { Workflow } from '../../database/entities/approvals/workflow.entity';
import { WorkflowStep } from '../../database/entities/approvals/workflow-step.entity';
import { Approval } from '../../database/entities/approvals/approval.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';

// This exercises RequisitionsService and ApprovalsService wired together through a
// real EventEmitter2 (not mocked) so the full submit -> approve -> finalize -> side-effect
// chain runs end to end, the way it does in production — only the repositories are mocked.

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REQUESTER = { id: 'emp-req', userId: 'user-emp', lineManagerId: 'emp-mgr', departmentId: 'dept-1' };
const MANAGER = { id: 'emp-mgr', userId: 'user-mgr', lineManagerId: null, departmentId: 'dept-1' };

const STEP_MANAGER: WorkflowStep = {
  id: 'step-1',
  workflowId: 'wf-req',
  workflow: null as never,
  stepOrder: 1,
  approverType: ApproverType.LineManager,
  approverRef: null,
  isMandatory: true,
  slaHours: 24,
  minMetricValue: null,
  maxMetricValue: null,
  createdAt: new Date(),
};

const STEP_HR: WorkflowStep = {
  id: 'step-2',
  workflowId: 'wf-req',
  workflow: null as never,
  stepOrder: 2,
  approverType: ApproverType.Role,
  approverRef: 'HR Admin',
  isMandatory: true,
  slaHours: 48,
  minMetricValue: null,
  maxMetricValue: null,
  createdAt: new Date(),
};

const WORKFLOW: Workflow = {
  id: 'wf-req',
  name: 'Requisition Approval',
  entityType: ApprovalEntityType.Requisition,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [STEP_MANAGER, STEP_HR],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

async function buildContext() {
  const requisitionRepo = makeRepo();
  const itemRepo = makeRepo();
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
  approvalRepo.save = jest.fn().mockImplementation((a: Approval) => {
    savedApproval = a;
    return Promise.resolve(a);
  });
  approvalRepo.findOne = jest.fn().mockImplementation(() => Promise.resolve(savedApproval));

  const actionRepo = makeRepo();

  let createdRequisitionId = '';
  const em = {
    save: jest.fn().mockImplementation((_entity: unknown, val: unknown) => Promise.resolve(val)),
    create: jest.fn().mockImplementation((entity: unknown, val: Record<string, unknown>) => {
      if (entity === Requisition) {
        createdRequisitionId = 'req-1';
        return { id: 'req-1', ...val };
      }
      return val;
    }),
    update: jest.fn().mockImplementation((entity: unknown, _where: unknown, val: Record<string, unknown>) => {
      if (entity === Requisition) requisitionRepo.findOne.mockResolvedValue({ id: createdRequisitionId, ...val });
      return Promise.resolve(undefined);
    }),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (cb: (em: unknown) => unknown) => cb(em)),
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'user-hr' }]),
      }),
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot()],
    providers: [
      RequisitionsService,
      ApprovalsService,
      { provide: getRepositoryToken(Requisition), useValue: requisitionRepo },
      { provide: getRepositoryToken(RequisitionItem), useValue: itemRepo },
      { provide: getRepositoryToken(Employee), useValue: employeeRepo },
      { provide: getRepositoryToken(Workflow), useValue: workflowRepo },
      { provide: getRepositoryToken(WorkflowStep), useValue: makeRepo() },
      { provide: getRepositoryToken(Approval), useValue: approvalRepo },
      { provide: getRepositoryToken(ApprovalActionRecord), useValue: actionRepo },
      { provide: getRepositoryToken(Department), useValue: makeRepo() },
      { provide: getRepositoryToken(Role), useValue: makeRepo() },
      { provide: DataSource, useValue: dataSource },
    ],
  }).compile();

  // Triggers @nestjs/event-emitter's discovery pass, which binds RequisitionsService's
  // @OnEvent listeners to the real EventEmitter2 instance.
  await module.init();

  return {
    requisitionsSvc: module.get(RequisitionsService),
    approvalsSvc: module.get(ApprovalsService),
    requisitionRepo,
  };
}

const CREATE_DTO = {
  type: RequisitionType.Asset,
  title: 'New laptop',
  priority: RequisitionPriority.High,
  items: [
    { name: 'Laptop', quantity: 1, unitCost: 1200 },
    { name: 'Dock', quantity: 1, unitCost: 150 },
  ],
};

describe('Requisitions — submit -> approve integration', () => {
  it('routes through both workflow steps to a final Approved state', async () => {
    const { requisitionsSvc, approvalsSvc, requisitionRepo } = await buildContext();

    const requisition = await requisitionsSvc.createRequisition('user-emp', CREATE_DTO);
    expect(requisition.estimatedCost).toBe(1350);
    expect(requisition.approvalId).toBe('appr-1');

    // Step 1: line manager approves — advances, does not finalize
    const afterStep1 = await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Approve });
    expect(afterStep1.status).toBe(ApprovalStatus.Pending);
    expect(afterStep1.currentStep).toBe(2);
    expect(requisitionRepo.update).not.toHaveBeenCalled();

    // Step 2: HR Admin (role-resolved approver) approves — finalizes
    const afterStep2 = await approvalsSvc.act('appr-1', 'user-hr', { action: ApprovalAction.Approve });
    expect(afterStep2.status).toBe(ApprovalStatus.Approved);

    // The finalization event should have flipped the requisition's own status
    expect(requisitionRepo.update).toHaveBeenCalledWith(
      { id: 'req-1' },
      { status: RequisitionStatus.Approved },
    );
  });

  it('a rejection at any step marks the requisition Rejected', async () => {
    const { requisitionsSvc, approvalsSvc, requisitionRepo } = await buildContext();

    await requisitionsSvc.createRequisition('user-emp', CREATE_DTO);
    await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Reject, comment: 'Not needed' });

    expect(requisitionRepo.update).toHaveBeenCalledWith(
      { id: 'req-1' },
      { status: RequisitionStatus.Rejected },
    );
  });

  it('prevents cancelling a requisition that belongs to someone else', async () => {
    const { requisitionsSvc, requisitionRepo } = await buildContext();
    await requisitionsSvc.createRequisition('user-emp', CREATE_DTO);
    requisitionRepo.findOne.mockResolvedValue({
      id: 'req-1',
      requesterId: 'emp-req',
      status: RequisitionStatus.Pending,
      approvalId: 'appr-1',
    });

    await expect(requisitionsSvc.cancelRequisition('req-1', 'user-mgr')).rejects.toThrow(ForbiddenException);
  });
});
