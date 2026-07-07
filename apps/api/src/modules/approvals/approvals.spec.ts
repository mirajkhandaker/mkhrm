import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { Workflow } from '../../database/entities/approvals/workflow.entity';
import { WorkflowStep } from '../../database/entities/approvals/workflow-step.entity';
import { Approval } from '../../database/entities/approvals/approval.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Role } from '../../database/entities/auth/role.entity';
import {
  ApprovalEntityType,
  ApprovalStatus,
  ApprovalAction,
  ApproverType,
} from '@hrm/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STEP_LINE_MANAGER: WorkflowStep = {
  id: 'step-1',
  workflowId: 'wf-1',
  workflow: null as never,
  stepOrder: 1,
  approverType: ApproverType.LineManager,
  approverRef: null,
  isMandatory: true,
  slaHours: null,
  minMetricValue: null,
  maxMetricValue: null,
  createdAt: new Date(),
};

const STEP_2_ROLE: WorkflowStep = {
  id: 'step-2',
  workflowId: 'wf-1',
  workflow: null as never,
  stepOrder: 2,
  approverType: ApproverType.Role,
  approverRef: 'role-hr-admin',
  isMandatory: true,
  slaHours: null,
  minMetricValue: null,
  maxMetricValue: null,
  createdAt: new Date(),
};

const WORKFLOW: Workflow = {
  id: 'wf-1',
  name: 'Leave Approval',
  entityType: ApprovalEntityType.Leave,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [STEP_LINE_MANAGER],
};

const WORKFLOW_MULTI: Workflow = {
  ...WORKFLOW,
  id: 'wf-2',
  steps: [STEP_LINE_MANAGER, STEP_2_ROLE],
};

const PENDING_APPROVAL: Approval = {
  id: 'appr-1',
  workflowId: 'wf-1',
  workflow: WORKFLOW,
  entityType: ApprovalEntityType.Leave,
  entityId: 'leave-1',
  currentStep: 1,
  status: ApprovalStatus.Pending,
  requestedBy: 'user-requester',
  requester: null as never,
  metricValue: null,
  approvedAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  actions: [],
};

const MANAGER_EMPLOYEE = {
  id: 'emp-manager',
  userId: 'user-manager',
  lineManagerId: null,
  departmentId: 'dept-1',
};

const REQUESTER_EMPLOYEE = {
  id: 'emp-requester',
  userId: 'user-requester',
  lineManagerId: 'emp-manager',
  departmentId: 'dept-1',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRepo<T extends object>(entity: T | null = null) {
  return {
    find: jest.fn().mockImplementation(() =>
      Promise.resolve(entity ? [{ ...entity }] : []),
    ),
    findOne: jest.fn().mockImplementation(() =>
      Promise.resolve(entity ? { ...entity } : null),
    ),
    save: jest.fn().mockImplementation((e: T) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: Partial<T>) => e as T),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

function makeEventEmitter() {
  return { emit: jest.fn() };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ApprovalsService', () => {
  let svc: ApprovalsService;
  let workflowRepo: ReturnType<typeof makeRepo<Workflow>>;
  let approvalRepo: ReturnType<typeof makeRepo<Approval>>;
  let actionRepo: ReturnType<typeof makeRepo<ApprovalActionRecord>>;
  let employeeRepo: ReturnType<typeof makeRepo<typeof REQUESTER_EMPLOYEE>>;
  let emitter: ReturnType<typeof makeEventEmitter>;

  beforeEach(async () => {
    workflowRepo = makeRepo(WORKFLOW);
    approvalRepo = makeRepo(PENDING_APPROVAL);
    actionRepo = makeRepo(null);
    employeeRepo = makeRepo(REQUESTER_EMPLOYEE);

    // employeeRepo.findOne returns requester or manager depending on input
    employeeRepo.findOne = jest.fn().mockImplementation((opts: { where: { userId?: string; id?: string } }): Promise<typeof REQUESTER_EMPLOYEE | typeof MANAGER_EMPLOYEE | null> => {
      const { userId, id } = opts.where;
      if (userId === 'user-requester') return Promise.resolve(REQUESTER_EMPLOYEE);
      if (id === 'emp-manager') return Promise.resolve(MANAGER_EMPLOYEE);
      return Promise.resolve(null);
    });

    emitter = makeEventEmitter();

    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([{ id: 'user-hr' }]),
        }),
      }),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: getRepositoryToken(Workflow), useValue: workflowRepo },
        { provide: getRepositoryToken(WorkflowStep), useValue: makeRepo(null) },
        { provide: getRepositoryToken(Approval), useValue: approvalRepo },
        { provide: getRepositoryToken(ApprovalActionRecord), useValue: actionRepo },
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
        { provide: getRepositoryToken(Department), useValue: makeRepo(null) },
        { provide: getRepositoryToken(Role), useValue: makeRepo(null) },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    svc = module.get(ApprovalsService);
  });

  // ── start() ────────────────────────────────────────────────────────────────

  describe('start()', () => {
    it('creates an approval at step 1 when a workflow exists', async () => {
      const result = await svc.start({
        entityType: ApprovalEntityType.Leave,
        entityId: 'leave-99',
        requesterId: 'user-requester',
      });
      expect(approvalRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        entityType: ApprovalEntityType.Leave,
        entityId: 'leave-99',
        currentStep: 1,
        status: ApprovalStatus.Pending,
      });
      expect(emitter.emit).toHaveBeenCalledWith('approval.pending', expect.objectContaining({
        entityId: 'leave-99',
        currentStep: 1,
        approverIds: ['user-manager'],
      }));
    });

    it('throws NotFoundException when no active workflow exists', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(
        svc.start({ entityType: ApprovalEntityType.Leave, entityId: 'x', requesterId: 'u' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── act() ─────────────────────────────────────────────────────────────────

  describe('act() — single-step workflow', () => {
    it('approve on the only step finalizes the approval and emits approval.approved', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW);
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-1', 'user-manager', {
        action: ApprovalAction.Approve,
      });

      expect(result.status).toBe(ApprovalStatus.Approved);
      expect(emitter.emit).toHaveBeenCalledWith('approval.approved', expect.objectContaining({
        entityType: ApprovalEntityType.Leave,
        entityId: 'leave-1',
        status: ApprovalStatus.Approved,
      }));
    });

    it('reject marks as rejected and emits approval.rejected', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW);
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-1', 'user-manager', {
        action: ApprovalAction.Reject,
        comment: 'Not valid',
      });

      expect(result.status).toBe(ApprovalStatus.Rejected);
      expect(emitter.emit).toHaveBeenCalledWith('approval.rejected', expect.objectContaining({
        status: ApprovalStatus.Rejected,
      }));
    });

    it('return resets currentStep to 1 without finalizing', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW);
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-1', 'user-manager', {
        action: ApprovalAction.Return,
        comment: 'Please fix the dates',
      });

      expect(result.status).toBe(ApprovalStatus.Pending);
      expect(result.currentStep).toBe(1);
      expect(emitter.emit).toHaveBeenCalledWith('approval.returned', expect.objectContaining({
        requestedBy: 'user-requester',
      }));
    });
  });

  describe('act() — multi-step workflow', () => {
    it('approve at step 1 advances to step 2 without finalizing, notifying the next approver', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW_MULTI);
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-1', 'user-manager', {
        action: ApprovalAction.Approve,
      });

      expect(result.status).toBe(ApprovalStatus.Pending);
      expect(result.currentStep).toBe(2);
      expect(emitter.emit).toHaveBeenCalledWith('approval.pending', expect.objectContaining({
        currentStep: 2,
        approverIds: ['user-hr'],
      }));
    });
  });

  describe('act() — guards', () => {
    it('throws BadRequestException when approval is not pending', async () => {
      approvalRepo.findOne = jest.fn().mockResolvedValue({
        ...PENDING_APPROVAL,
        status: ApprovalStatus.Approved,
      });

      await expect(
        svc.act('appr-1', 'user-manager', { action: ApprovalAction.Approve }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when actor is not the designated approver', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW);
      // employeeRepo.findOne won't match 'not-the-manager' as a line manager
      employeeRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        svc.act('appr-1', 'some-random-user', { action: ApprovalAction.Approve }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when approval does not exist', async () => {
      approvalRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(
        svc.act('bad-id', 'user-manager', { action: ApprovalAction.Approve }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('finalization events', () => {
    it('emits approval.pending (not a finalization event) when advancing steps', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW_MULTI);
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      await svc.act('appr-1', 'user-manager', { action: ApprovalAction.Approve });
      expect(emitter.emit).not.toHaveBeenCalledWith('approval.approved', expect.anything());
      expect(emitter.emit).not.toHaveBeenCalledWith('approval.rejected', expect.anything());
    });

    it('emits approval.approved on final step approve', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(WORKFLOW);
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      await svc.act('appr-1', 'user-manager', { action: ApprovalAction.Approve });
      expect(emitter.emit).toHaveBeenCalledWith('approval.approved', expect.objectContaining({
        approvalId: 'appr-1',
      }));
    });
  });

  // ── Manager-chain hierarchy & conditional (metric-based) steps ─────────────

  describe('manager chain hierarchy & conditional steps', () => {
    // A four-level org chain: REQ -> MGR (level 1) -> MGR2 (level 2) -> MGR3 (level 3, top).
    const REQ = { id: 'emp-req', userId: 'user-req', lineManagerId: 'emp-mgr1', departmentId: 'dept-1' };
    const MGR1 = { id: 'emp-mgr1', userId: 'user-mgr1', lineManagerId: 'emp-mgr2', departmentId: 'dept-1' };
    const MGR2 = { id: 'emp-mgr2', userId: 'user-mgr2', lineManagerId: 'emp-mgr3', departmentId: 'dept-1' };
    const MGR3 = { id: 'emp-mgr3', userId: 'user-mgr3', lineManagerId: null, departmentId: 'dept-1' };

    const STEP_L1: WorkflowStep = {
      id: 'step-l1', workflowId: 'wf-chain', workflow: null as never, stepOrder: 1,
      approverType: ApproverType.ManagerChainLevel, approverRef: '1', isMandatory: true, slaHours: null,
      minMetricValue: null, maxMetricValue: null, createdAt: new Date(),
    };
    const STEP_L2: WorkflowStep = {
      id: 'step-l2', workflowId: 'wf-chain', workflow: null as never, stepOrder: 2,
      approverType: ApproverType.ManagerChainLevel, approverRef: '2', isMandatory: true, slaHours: null,
      minMetricValue: '4', maxMetricValue: null, createdAt: new Date(),
    };
    const STEP_L3: WorkflowStep = {
      id: 'step-l3', workflowId: 'wf-chain', workflow: null as never, stepOrder: 3,
      approverType: ApproverType.ManagerChainLevel, approverRef: '3', isMandatory: true, slaHours: null,
      minMetricValue: '8', maxMetricValue: null, createdAt: new Date(),
    };
    const CHAIN_WORKFLOW: Workflow = {
      id: 'wf-chain', name: 'Leave Approval', entityType: ApprovalEntityType.Leave,
      isActive: true, createdAt: new Date(), updatedAt: new Date(), steps: [STEP_L1, STEP_L2, STEP_L3],
    };

    function employeeLookup(map: Record<string, unknown>) {
      return jest.fn().mockImplementation((opts: { where: { userId?: string; id?: string } }) => {
        const { userId, id } = opts.where;
        const key = userId ?? id;
        return Promise.resolve(key ? map[key] ?? null : null);
      });
    }

    const chainMap = {
      'user-req': REQ, 'emp-req': REQ,
      'user-mgr1': MGR1, 'emp-mgr1': MGR1,
      'user-mgr2': MGR2, 'emp-mgr2': MGR2,
      'user-mgr3': MGR3, 'emp-mgr3': MGR3,
    };

    it('unconditional step 1 applies regardless of metric value', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(CHAIN_WORKFLOW);
      employeeRepo.findOne = employeeLookup(chainMap);

      const result = await svc.start({
        entityType: ApprovalEntityType.Leave, entityId: 'leave-1', requesterId: 'user-req', metricValue: 2,
      });

      expect(result.currentStep).toBe(1);
      expect(emitter.emit).toHaveBeenCalledWith('approval.pending', expect.objectContaining({
        currentStep: 1, approverIds: ['user-mgr1'],
      }));
    });

    it('escalates to level 2 only once the metric crosses its threshold', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(CHAIN_WORKFLOW);
      employeeRepo.findOne = employeeLookup(chainMap);
      approvalRepo.findOne = jest.fn().mockResolvedValue({
        ...PENDING_APPROVAL, id: 'appr-chain', workflowId: 'wf-chain', currentStep: 1, requestedBy: 'user-req', metricValue: '5',
      });
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-chain', 'user-mgr1', { action: ApprovalAction.Approve });

      expect(result.status).toBe(ApprovalStatus.Pending);
      expect(result.currentStep).toBe(2);
      expect(emitter.emit).toHaveBeenCalledWith('approval.pending', expect.objectContaining({
        currentStep: 2, approverIds: ['user-mgr2'],
      }));
    });

    it('skips level 2 and finalizes when the metric stays below its threshold', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(CHAIN_WORKFLOW);
      employeeRepo.findOne = employeeLookup(chainMap);
      approvalRepo.findOne = jest.fn().mockResolvedValue({
        ...PENDING_APPROVAL, id: 'appr-chain', workflowId: 'wf-chain', currentStep: 1, requestedBy: 'user-req', metricValue: '2',
      });
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-chain', 'user-mgr1', { action: ApprovalAction.Approve });

      expect(result.status).toBe(ApprovalStatus.Approved);
      expect(emitter.emit).toHaveBeenCalledWith('approval.approved', expect.objectContaining({
        approvalId: 'appr-chain',
      }));
    });

    it('requires all three levels once the metric crosses the level-3 threshold', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(CHAIN_WORKFLOW);
      employeeRepo.findOne = employeeLookup(chainMap);
      approvalRepo.findOne = jest.fn().mockResolvedValue({
        ...PENDING_APPROVAL, id: 'appr-chain', workflowId: 'wf-chain', currentStep: 2, requestedBy: 'user-req', metricValue: '9',
      });
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-chain', 'user-mgr2', { action: ApprovalAction.Approve });

      expect(result.status).toBe(ApprovalStatus.Pending);
      expect(result.currentStep).toBe(3);
      expect(emitter.emit).toHaveBeenCalledWith('approval.pending', expect.objectContaining({
        currentStep: 3, approverIds: ['user-mgr3'],
      }));
    });

    it('skips a step whose hierarchy level does not exist for this requester and finalizes', async () => {
      // MGR1 requests leave: level 1 = MGR2, level 2 = MGR3, but MGR3 has no manager, so
      // level 3 can never resolve an approver for this requester — the engine must skip past
      // the unresolvable step rather than stalling the approval forever.
      workflowRepo.findOne = jest.fn().mockResolvedValue(CHAIN_WORKFLOW);
      employeeRepo.findOne = employeeLookup(chainMap);
      approvalRepo.findOne = jest.fn().mockResolvedValue({
        ...PENDING_APPROVAL, id: 'appr-chain', workflowId: 'wf-chain', currentStep: 2, requestedBy: 'user-mgr1', metricValue: '9',
      });
      approvalRepo.save = jest.fn().mockImplementation((a: Approval) => Promise.resolve(a));

      const result = await svc.act('appr-chain', 'user-mgr3', { action: ApprovalAction.Approve });

      expect(result.status).toBe(ApprovalStatus.Approved);
      expect(emitter.emit).toHaveBeenCalledWith('approval.approved', expect.objectContaining({
        approvalId: 'appr-chain',
      }));
    });

    it('resolveApprover walks exactly N levels up for manager_chain_level', async () => {
      workflowRepo.findOne = jest.fn().mockResolvedValue(CHAIN_WORKFLOW);
      employeeRepo.findOne = employeeLookup(chainMap);

      const level1 = await svc.start({ entityType: ApprovalEntityType.Leave, entityId: 'l-1', requesterId: 'user-req', metricValue: 0 });
      expect(level1.currentStep).toBe(1);
      expect(emitter.emit).toHaveBeenLastCalledWith('approval.pending', expect.objectContaining({ approverIds: ['user-mgr1'] }));
    });
  });
});
