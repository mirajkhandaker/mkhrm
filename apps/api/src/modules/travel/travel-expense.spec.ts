import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ApprovalEntityType,
  ApprovalStatus,
  ApprovalAction,
  ApproverType,
  TravelRequestStatus,
  TravelRequestTiming,
  TravelSettlementStatus,
  ExpenseClaimStatus,
  TravelCostCategory,
} from '@hrm/types';
import { TravelService } from './travel.service';
import { ExpenseService } from './expense.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ChangeLogService } from '../change-log/change-log.service';
import { TravelRequest } from '../../database/entities/travel/travel-request.entity';
import { TravelRequestItem } from '../../database/entities/travel/travel-request-item.entity';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';
import { ExpenseItem } from '../../database/entities/travel/expense-item.entity';
import { Attachment } from '../../database/entities/system/attachment.entity';
import { RequestChangeLog } from '../../database/entities/system/request-change-log.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Role } from '../../database/entities/auth/role.entity';
import { Workflow } from '../../database/entities/approvals/workflow.entity';
import { WorkflowStep } from '../../database/entities/approvals/workflow-step.entity';
import { Approval } from '../../database/entities/approvals/approval.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';

// Exercises TravelService and ExpenseService wired to the real ApprovalsService/
// AttachmentsService/ChangeLogService through a real EventEmitter2 (not mocked), so the
// full submit -> approve -> finalize -> reimburse/settle chain runs end to end the way it
// does in production — only repositories are mocked.

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REQUESTER = { id: 'emp-req', userId: 'user-emp', lineManagerId: 'emp-mgr', departmentId: 'dept-1' };
const MANAGER = { id: 'emp-mgr', userId: 'user-mgr', lineManagerId: null, departmentId: 'dept-1' };

const STEP_MANAGER: WorkflowStep = {
  id: 'step-1', workflowId: 'wf-travel', workflow: null as never, stepOrder: 1,
  approverType: ApproverType.LineManager, approverRef: null, isMandatory: true, slaHours: 24,
  minMetricValue: null, maxMetricValue: null, createdAt: new Date(),
};

const TRAVEL_WORKFLOW: Workflow = {
  id: 'wf-travel', name: 'Travel Request Approval', entityType: ApprovalEntityType.TravelRequest,
  isActive: true, createdAt: new Date(), updatedAt: new Date(), steps: [STEP_MANAGER],
};

const STEP_SETTLEMENT: WorkflowStep = {
  id: 'step-1s', workflowId: 'wf-settlement', workflow: null as never, stepOrder: 1,
  approverType: ApproverType.Role, approverRef: 'Finance', isMandatory: true, slaHours: 48,
  minMetricValue: null, maxMetricValue: null, createdAt: new Date(),
};

const SETTLEMENT_WORKFLOW: Workflow = {
  id: 'wf-settlement', name: 'Travel Settlement Approval', entityType: ApprovalEntityType.TravelSettlement,
  isActive: true, createdAt: new Date(), updatedAt: new Date(), steps: [STEP_SETTLEMENT],
};

const STEP_MANAGER_EXP: WorkflowStep = { ...STEP_MANAGER, id: 'step-1e', workflowId: 'wf-expense' };
const STEP_FINANCE: WorkflowStep = {
  id: 'step-2e', workflowId: 'wf-expense', workflow: null as never, stepOrder: 2,
  approverType: ApproverType.Role, approverRef: 'Finance', isMandatory: true, slaHours: 48,
  minMetricValue: null, maxMetricValue: null, createdAt: new Date(),
};

const EXPENSE_WORKFLOW: Workflow = {
  id: 'wf-expense', name: 'Expense Claim Approval', entityType: ApprovalEntityType.ExpenseClaim,
  isActive: true, createdAt: new Date(), updatedAt: new Date(), steps: [STEP_MANAGER_EXP, STEP_FINANCE],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    create: jest.fn().mockImplementation((e: unknown) => e),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

async function buildContext() {
  const travelRepo = makeRepo();
  const travelItemRepo = makeRepo();
  const claimRepo = makeRepo();
  const itemRepo = makeRepo();
  const attachmentRepo = makeRepo();
  const changeLogRepo = makeRepo();

  const employeeRepo = makeRepo();
  employeeRepo.findOne = jest.fn().mockImplementation((opts: { where: { userId?: string; id?: string } }) => {
    const { userId, id } = opts.where;
    if (userId === 'user-emp' || id === 'emp-req') return Promise.resolve(REQUESTER);
    if (userId === 'user-mgr' || id === 'emp-mgr') return Promise.resolve(MANAGER);
    return Promise.resolve(null);
  });

  const workflowRepo = makeRepo();
  workflowRepo.findOne = jest.fn().mockImplementation((opts: { where: { entityType?: string; id?: string } }) => {
    const { entityType, id } = opts.where;
    if (entityType === ApprovalEntityType.TravelRequest || id === 'wf-travel') return Promise.resolve(TRAVEL_WORKFLOW);
    if (entityType === ApprovalEntityType.TravelSettlement || id === 'wf-settlement') return Promise.resolve(SETTLEMENT_WORKFLOW);
    if (entityType === ApprovalEntityType.ExpenseClaim || id === 'wf-expense') return Promise.resolve(EXPENSE_WORKFLOW);
    return Promise.resolve(null);
  });

  const approvals = new Map<string, Approval>();
  let approvalCounter = 0;
  const approvalRepo = makeRepo();
  approvalRepo.create = jest.fn().mockImplementation((e: Partial<Approval>) => {
    approvalCounter += 1;
    return { id: `appr-${approvalCounter}`, actions: [], ...e };
  });
  approvalRepo.save = jest.fn().mockImplementation((a: Approval) => {
    approvals.set(a.id, a);
    return Promise.resolve(a);
  });
  approvalRepo.findOne = jest.fn().mockImplementation(
    (opts: { where: { id?: string; entityType?: string; entityId?: string } }) => {
      const { id, entityType, entityId } = opts.where;
      if (id) return Promise.resolve(approvals.get(id) ?? null);
      if (entityType && entityId) {
        const matches = [...approvals.values()].filter((a) => a.entityType === entityType && a.entityId === entityId);
        return Promise.resolve(matches.length ? matches[matches.length - 1] : null);
      }
      return Promise.resolve(null);
    },
  );
  approvalRepo.update = jest.fn().mockImplementation((where: { id: string }, val: Partial<Approval>) => {
    const existing = approvals.get(where.id);
    if (existing) approvals.set(where.id, { ...existing, ...val });
    return Promise.resolve({ affected: 1 });
  });

  const actionRepo = makeRepo();

  const records = new Map<string, Record<string, unknown>>();
  const em = {
    save: jest.fn().mockImplementation((_entity: unknown, val: unknown) => Promise.resolve(val)),
    create: jest.fn().mockImplementation((entity: unknown, val: Record<string, unknown>) => {
      if (entity === TravelRequest || entity === ExpenseClaim) {
        const id = `${entity === TravelRequest ? 'travel' : 'claim'}-${records.size + 1}`;
        const record = { id, ...val };
        records.set(id, record);
        return record;
      }
      if (entity === TravelRequestItem || entity === ExpenseItem) {
        return { id: `item-${Math.random().toString(36).slice(2)}`, ...val };
      }
      return val;
    }),
    update: jest.fn().mockImplementation((entity: unknown, where: { id: string }, val: Record<string, unknown>) => {
      if (entity === TravelRequest) {
        const merged = { ...records.get(where.id), ...val };
        records.set(where.id, merged);
        travelRepo.findOne.mockResolvedValue(merged);
      }
      if (entity === ExpenseClaim) {
        const merged = { ...records.get(where.id), ...val };
        records.set(where.id, merged);
        claimRepo.findOne.mockResolvedValue(merged);
      }
      return Promise.resolve(undefined);
    }),
    delete: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockImplementation((entity: unknown, opts: { where: { id: string } }) => {
      if (entity === TravelRequest) return Promise.resolve(records.get(opts.where.id) ?? null);
      if (entity === ExpenseClaim) return Promise.resolve(records.get(opts.where.id) ?? null);
      return Promise.resolve(null);
    }),
  };

  const dataSource = {
    transaction: jest.fn().mockImplementation(async (cb: (em: unknown) => unknown) => cb(em)),
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'user-finance' }]),
      }),
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [EventEmitterModule.forRoot()],
    providers: [
      TravelService,
      ExpenseService,
      ApprovalsService,
      AttachmentsService,
      ChangeLogService,
      { provide: getRepositoryToken(TravelRequest), useValue: travelRepo },
      { provide: getRepositoryToken(TravelRequestItem), useValue: travelItemRepo },
      { provide: getRepositoryToken(ExpenseClaim), useValue: claimRepo },
      { provide: getRepositoryToken(ExpenseItem), useValue: itemRepo },
      { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
      { provide: getRepositoryToken(RequestChangeLog), useValue: changeLogRepo },
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

  // Triggers @nestjs/event-emitter's discovery pass, binding TravelService/ExpenseService's
  // @OnEvent listeners to the real EventEmitter2 instance.
  await module.init();

  return {
    travelSvc: module.get(TravelService),
    expenseSvc: module.get(ExpenseService),
    approvalsSvc: module.get(ApprovalsService),
    em,
    travelRepo,
    travelItemRepo,
    claimRepo,
    itemRepo,
    changeLogRepo,
    approvalRepo,
  };
}

describe('Travel request — pre-trip approval', () => {
  it('a single-step approve finalizes the trip to Approved and captures the advance amount', async () => {
    const { travelSvc, approvalsSvc, travelRepo } = await buildContext();

    const trip = await travelSvc.createTravelRequest('user-emp', {
      purpose: 'Client visit',
      fromDate: '2026-08-01', toDate: '2026-08-03',
      advanceRequested: 300,
      items: [{ description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 300 }],
    });
    expect(trip.approvalId).toBe('appr-1');
    expect(trip.estimatedCost).toBe(300);

    const result = await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Approve });
    expect(result.status).toBe(ApprovalStatus.Approved);
    expect(travelRepo.update).toHaveBeenCalledWith(
      { id: 'travel-1' },
      { status: TravelRequestStatus.Approved, approvedAdvanceAmount: 300 },
    );
  });

  it('an approver can override the advance amount, and the override is what gets applied', async () => {
    const { travelSvc, approvalsSvc, travelRepo } = await buildContext();

    await travelSvc.createTravelRequest('user-emp', {
      purpose: 'Client visit',
      fromDate: '2026-08-01', toDate: '2026-08-03',
      advanceRequested: 500,
      items: [{ description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 500 }],
    });

    await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Approve, approvedAmount: 400 });

    expect(travelRepo.update).toHaveBeenCalledWith(
      { id: 'travel-1' },
      { status: TravelRequestStatus.Approved, approvedAdvanceAmount: 400 },
    );
  });

  it('prevents cancelling a trip that belongs to someone else', async () => {
    const { travelSvc, travelRepo } = await buildContext();
    await travelSvc.createTravelRequest('user-emp', {
      purpose: 'Client visit',
      fromDate: '2026-08-01', toDate: '2026-08-03',
      items: [{ description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 300 }],
    });
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', employeeId: 'emp-req', status: TravelRequestStatus.Pending, approvalId: 'appr-1',
    });

    await expect(travelSvc.cancelTravelRequest('travel-1', 'user-mgr')).rejects.toThrow(ForbiddenException);
  });

  it('sums multiple leg items into the request-level estimated cost', async () => {
    const { travelSvc } = await buildContext();

    const trip = await travelSvc.createTravelRequest('user-emp', {
      purpose: 'Regional roadshow',
      fromDate: '2026-08-01', toDate: '2026-08-05',
      items: [
        { description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 300 },
        { description: 'Sylhet', category: TravelCostCategory.Lodging, fromDate: '2026-08-03', toDate: '2026-08-03', estimatedCost: 250 },
      ],
    });

    expect(trip.estimatedCost).toBe(550);
  });
});

describe('Travel request — editing restarts approval', () => {
  it('editing a pending trip cancels the old approval, starts a fresh one, and logs the change', async () => {
    const { travelSvc, travelRepo, travelItemRepo, em, approvalRepo } = await buildContext();

    const trip = await travelSvc.createTravelRequest('user-emp', {
      purpose: 'Client visit',
      fromDate: '2026-08-01', toDate: '2026-08-03',
      items: [{ description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 300 }],
    });
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', employeeId: 'emp-req', status: TravelRequestStatus.Pending,
      settlementStatus: TravelSettlementStatus.None, approvalId: trip.approvalId,
      purpose: trip.purpose, fromDate: trip.fromDate, toDate: trip.toDate, advanceRequested: 0,
      items: [{ id: 'item-old', description: 'Chittagong', category: TravelCostCategory.Travel, estimatedCost: 300 }],
    });

    const updated = await travelSvc.updateTravelRequest('travel-1', 'user-emp', {
      items: [{ description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 700 }],
    });

    expect(updated?.estimatedCost).toBe(700);
    expect(updated?.status).toBe(TravelRequestStatus.Pending);
    expect(travelItemRepo).toBeDefined();
    expect(approvalRepo.update).toHaveBeenCalledWith(
      { id: 'appr-1' },
      { status: ApprovalStatus.Cancelled },
    );
    expect(em.save.mock.calls.some(([entity]: [unknown]) => entity === RequestChangeLog)).toBe(true);
  });

  it('refuses to edit a trip that already has a settlement in progress', async () => {
    const { travelSvc, travelRepo } = await buildContext();
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', employeeId: 'emp-req', status: TravelRequestStatus.Approved,
      settlementStatus: TravelSettlementStatus.Pending, items: [],
    });

    await expect(
      travelSvc.updateTravelRequest('travel-1', 'user-emp', {
        items: [{ description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 300 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('Travel settlement', () => {
  async function approvedTrip(travelSvc: TravelService, travelRepo: ReturnType<typeof makeRepo>, approvalsSvc: ApprovalsService) {
    const trip = await travelSvc.createTravelRequest('user-emp', {
      purpose: 'Client visit',
      fromDate: '2026-08-01', toDate: '2026-08-03',
      advanceRequested: 500,
      items: [{ description: 'Chittagong', category: TravelCostCategory.Travel, fromDate: '2026-08-01', toDate: '2026-08-01', estimatedCost: 500 }],
    });
    await approvalsSvc.act(trip.approvalId as string, 'user-mgr', { action: ApprovalAction.Approve });
    const approved = {
      id: 'travel-1', employeeId: 'emp-req', status: TravelRequestStatus.Approved,
      settlementStatus: TravelSettlementStatus.None, approvedAdvanceAmount: 500, advanceRequested: 500,
      items: [{ id: 'item-1', description: 'Chittagong', category: TravelCostCategory.Travel, estimatedCost: 500, actualCost: null, note: null }],
    };
    travelRepo.findOne.mockResolvedValue(approved);
    return approved;
  }

  it('computes a positive net adjustment when actual cost exceeds the advance', async () => {
    const { travelSvc, approvalsSvc, travelRepo } = await buildContext();
    await approvedTrip(travelSvc, travelRepo, approvalsSvc);

    const settled = await travelSvc.submitSettlement('travel-1', 'user-emp', {
      items: [{ itemId: 'item-1', actualCost: 700 }],
    });

    expect(settled?.actualCost).toBe(700);
    expect(settled?.netAdjustment).toBe(200);
    expect(settled?.settlementStatus).toBe(TravelSettlementStatus.Pending);
  });

  it('locking requires an Approved settlement', async () => {
    const { travelSvc, travelRepo } = await buildContext();
    travelRepo.findOne.mockResolvedValue({ id: 'travel-1', settlementStatus: TravelSettlementStatus.Pending });

    await expect(travelSvc.lockSettlement('travel-1', 'user-finance')).rejects.toThrow(BadRequestException);
  });

  it('locks an approved settlement, and resubmitting afterward reopens it with a fresh approval', async () => {
    const { travelSvc, approvalsSvc, travelRepo, approvalRepo } = await buildContext();
    await approvedTrip(travelSvc, travelRepo, approvalsSvc);

    await travelSvc.submitSettlement('travel-1', 'user-emp', { items: [{ itemId: 'item-1', actualCost: 700 }] });
    await approvalsSvc.act('appr-2', 'user-finance', { action: ApprovalAction.Approve });
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', employeeId: 'emp-req', status: TravelRequestStatus.Approved,
      settlementStatus: TravelSettlementStatus.Approved, approvedAdvanceAmount: 500, advanceRequested: 500,
      items: [{ id: 'item-1', description: 'Chittagong', category: TravelCostCategory.Travel, estimatedCost: 500, actualCost: 700, note: null }],
    });

    await travelSvc.lockSettlement('travel-1', 'user-finance');
    expect(travelRepo.update).toHaveBeenCalledWith(
      { id: 'travel-1' },
      expect.objectContaining({ settlementStatus: TravelSettlementStatus.Locked, settlementLockedBy: 'user-finance' }),
    );

    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', employeeId: 'emp-req', status: TravelRequestStatus.Approved,
      settlementStatus: TravelSettlementStatus.Locked, approvedAdvanceAmount: 500, advanceRequested: 500,
      items: [{ id: 'item-1', description: 'Chittagong', category: TravelCostCategory.Travel, estimatedCost: 500, actualCost: 700, note: null }],
    });

    const reopened = await travelSvc.submitSettlement('travel-1', 'user-emp', {
      items: [{ itemId: 'item-1', actualCost: 750 }],
    });

    expect(reopened?.settlementStatus).toBe(TravelSettlementStatus.Pending);
    expect(reopened?.netAdjustment).toBe(250);
    // A brand new Approval row was started for the reopened settlement (appr-3), while the
    // first settlement approval (appr-2) remains in the DB, untouched, as history.
    expect(approvalRepo.create).toHaveBeenCalledTimes(3);
  });
});

describe('Travel request — post-trip reimbursement (no advance)', () => {
  it('forces advanceRequested to 0 for a post-trip request even if the client sends one', async () => {
    const { travelSvc } = await buildContext();

    const trip = await travelSvc.createTravelRequest('user-emp', {
      purpose: 'Client site visit (unplanned)',
      timing: TravelRequestTiming.PostTrip,
      fromDate: '2020-01-01', toDate: '2020-01-02',
      advanceRequested: 500,
      items: [{ description: 'Taxi fare', category: TravelCostCategory.Travel, fromDate: '2020-01-01', toDate: '2020-01-01', estimatedCost: 180 }],
    });

    expect(trip.timing).toBe(TravelRequestTiming.PostTrip);
    expect(trip.advanceRequested).toBe(0);
  });

  it('rejects a post-trip request whose end date is in the future', async () => {
    const { travelSvc } = await buildContext();

    await expect(travelSvc.createTravelRequest('user-emp', {
      purpose: 'Client site visit (unplanned)',
      timing: TravelRequestTiming.PostTrip,
      fromDate: '2099-01-01', toDate: '2099-01-02',
      items: [{ description: 'Taxi fare', category: TravelCostCategory.Travel, fromDate: '2099-01-01', toDate: '2099-01-01', estimatedCost: 180 }],
    })).rejects.toThrow(BadRequestException);
  });

  it('refuses to settle a post-trip request — there is no advance to reconcile', async () => {
    const { travelSvc, travelRepo } = await buildContext();
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', employeeId: 'emp-req', timing: TravelRequestTiming.PostTrip,
      status: TravelRequestStatus.Approved, items: [],
    });

    await expect(
      travelSvc.submitSettlement('travel-1', 'user-emp', { items: [{ itemId: 'item-1', actualCost: 180 }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses to reimburse a pre-trip request', async () => {
    const { travelSvc, travelRepo } = await buildContext();
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', timing: TravelRequestTiming.PreTrip, status: TravelRequestStatus.Approved,
    });

    await expect(
      travelSvc.reimburseTravelRequest('travel-1', { reimbursementRef: 'TXN-100' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses to reimburse a post-trip request that is not yet Approved', async () => {
    const { travelSvc, travelRepo } = await buildContext();
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', timing: TravelRequestTiming.PostTrip, status: TravelRequestStatus.Pending,
    });

    await expect(
      travelSvc.reimburseTravelRequest('travel-1', { reimbursementRef: 'TXN-100' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks an approved post-trip request Reimbursed with a reference', async () => {
    const { travelSvc, travelRepo } = await buildContext();
    travelRepo.findOne.mockResolvedValue({
      id: 'travel-1', employeeId: 'emp-req', timing: TravelRequestTiming.PostTrip,
      status: TravelRequestStatus.Approved,
    });

    await travelSvc.reimburseTravelRequest('travel-1', { reimbursementRef: 'TXN-100' });

    expect(travelRepo.update).toHaveBeenCalledWith(
      { id: 'travel-1' },
      expect.objectContaining({ status: TravelRequestStatus.Reimbursed, reimbursementRef: 'TXN-100' }),
    );
  });

  it('the reimbursable list only queries approved post-trip requests', async () => {
    const { travelSvc, travelRepo } = await buildContext();

    await travelSvc.getReimbursableTravelRequests();

    expect(travelRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: TravelRequestStatus.Approved, timing: TravelRequestTiming.PostTrip },
    }));
  });
});

describe('Expense claim — approval and reimbursement', () => {
  it('routes through both workflow steps to Approved, then Finance reimburses it', async () => {
    const { expenseSvc, approvalsSvc, claimRepo } = await buildContext();

    const claim = await expenseSvc.createExpenseClaim('user-emp', {
      title: 'Client visit expenses',
      items: [
        { description: 'Bus fare', amount: 150, spentOn: '2026-08-01' },
        { description: 'Lunch', amount: 40, spentOn: '2026-08-01' },
      ],
    });
    expect(claim.totalAmount).toBe(190);
    expect(claim.approvalId).toBe('appr-1');

    // Step 1: line manager approves — advances, does not finalize
    const afterStep1 = await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Approve });
    expect(afterStep1.status).toBe(ApprovalStatus.Pending);
    expect(afterStep1.currentStep).toBe(2);
    expect(claimRepo.update).not.toHaveBeenCalled();

    // Step 2: Finance (role-resolved approver) approves — finalizes
    const afterStep2 = await approvalsSvc.act('appr-1', 'user-finance', { action: ApprovalAction.Approve });
    expect(afterStep2.status).toBe(ApprovalStatus.Approved);
    expect(claimRepo.update).toHaveBeenCalledWith(
      { id: 'claim-1' },
      { status: ExpenseClaimStatus.Approved, approvedAmount: 190 },
    );

    // Finance marks it reimbursed with a reference
    claimRepo.findOne.mockResolvedValue({ id: 'claim-1', status: ExpenseClaimStatus.Approved });
    await expenseSvc.reimburseExpenseClaim('claim-1', { reimbursementRef: 'TXN-001' });
    expect(claimRepo.update).toHaveBeenCalledWith(
      { id: 'claim-1' },
      expect.objectContaining({ status: ExpenseClaimStatus.Reimbursed, reimbursementRef: 'TXN-001' }),
    );
  });

  it('refuses to reimburse a claim that is not yet Approved', async () => {
    const { expenseSvc, claimRepo } = await buildContext();
    claimRepo.findOne.mockResolvedValue({ id: 'claim-9', status: ExpenseClaimStatus.Pending });

    await expect(
      expenseSvc.reimburseExpenseClaim('claim-9', { reimbursementRef: 'TXN-002' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('a rejection at any step marks the claim Rejected', async () => {
    const { expenseSvc, approvalsSvc, claimRepo } = await buildContext();
    await expenseSvc.createExpenseClaim('user-emp', {
      title: 'Client visit expenses',
      items: [{ description: 'Lunch', amount: 40, spentOn: '2026-08-01' }],
    });

    await approvalsSvc.act('appr-1', 'user-mgr', { action: ApprovalAction.Reject, comment: 'Missing receipt' });

    expect(claimRepo.update).toHaveBeenCalledWith({ id: 'claim-1' }, { status: ExpenseClaimStatus.Rejected });
  });
});

describe('Expense claim — editing restarts approval', () => {
  it('adding/removing items restarts approval and logs the change', async () => {
    const { expenseSvc, claimRepo, approvalRepo, em } = await buildContext();

    const claim = await expenseSvc.createExpenseClaim('user-emp', {
      title: 'Client visit expenses',
      items: [{ description: 'Lunch', amount: 40, spentOn: '2026-08-01' }],
    });
    claimRepo.findOne.mockResolvedValue({
      id: 'claim-1', employeeId: 'emp-req', status: ExpenseClaimStatus.Pending, approvalId: claim.approvalId,
      title: claim.title,
      items: [{ id: 'item-old', description: 'Lunch', amount: 40 }],
    });

    const updated = await expenseSvc.updateExpenseClaim('claim-1', 'user-emp', {
      items: [
        { description: 'Lunch', amount: 40, spentOn: '2026-08-01', id: 'item-old' },
        { description: 'Taxi', amount: 25, spentOn: '2026-08-01' },
      ],
    });

    expect(updated?.totalAmount).toBe(65);
    expect(updated?.status).toBe(ExpenseClaimStatus.Pending);
    expect(approvalRepo.update).toHaveBeenCalledWith({ id: 'appr-1' }, { status: ApprovalStatus.Cancelled });
    expect(em.save.mock.calls.some(([entity]: [unknown]) => entity === RequestChangeLog)).toBe(true);
  });

  it('refuses to edit a reimbursed claim', async () => {
    const { expenseSvc, claimRepo } = await buildContext();
    claimRepo.findOne.mockResolvedValue({
      id: 'claim-1', employeeId: 'emp-req', status: ExpenseClaimStatus.Reimbursed, items: [],
    });

    await expect(
      expenseSvc.updateExpenseClaim('claim-1', 'user-emp', {
        items: [{ description: 'Taxi', amount: 25, spentOn: '2026-08-01' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
