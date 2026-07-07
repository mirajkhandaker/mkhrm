import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApprovalEntityType,
  ApprovalStatus,
  ApprovalAction as ApprovalActionType,
  ApproverType,
} from '@hrm/types';
import { Workflow } from '../../database/entities/approvals/workflow.entity';
import { WorkflowStep } from '../../database/entities/approvals/workflow-step.entity';
import { Approval } from '../../database/entities/approvals/approval.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { User } from '../../database/entities/auth/user.entity';
import { Role } from '../../database/entities/auth/role.entity';
import { ActApprovalDto } from './dto/act-approval.dto';
import { CreateWorkflowDto, CreateWorkflowStepDto } from './dto/create-workflow.dto';
import { UpdateWorkflowStepDto } from './dto/update-workflow-step.dto';

export interface StartApprovalParams {
  entityType: ApprovalEntityType;
  entityId: string;
  requesterId: string;
  metricValue?: number;
}

export interface ApprovalFinalizedEvent {
  entityType: ApprovalEntityType;
  entityId: string;
  approvalId: string;
  status: ApprovalStatus.Approved | ApprovalStatus.Rejected;
  requestedBy: string;
  approvedAmount?: number;
}

export interface ApprovalPendingEvent {
  entityType: ApprovalEntityType;
  entityId: string;
  approvalId: string;
  currentStep: number;
  approverIds: string[];
}

export interface ApprovalReturnedEvent {
  entityType: ApprovalEntityType;
  entityId: string;
  approvalId: string;
  requestedBy: string;
}

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Workflow) private workflowRepo: Repository<Workflow>,
    @InjectRepository(WorkflowStep) private stepRepo: Repository<WorkflowStep>,
    @InjectRepository(Approval) private approvalRepo: Repository<Approval>,
    @InjectRepository(ApprovalActionRecord) private actionRepo: Repository<ApprovalActionRecord>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(Department) private departmentRepo: Repository<Department>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Workflow admin ──────────────────────────────────────────────────────────

  findAllWorkflows() {
    return this.workflowRepo.find({
      relations: ['steps'],
      order: { entityType: 'ASC' },
    });
  }

  async createWorkflow(dto: CreateWorkflowDto) {
    for (const step of dto.steps ?? []) {
      await this.validateApproverRef(step.approverType, step.approverRef ?? null);
    }

    return this.dataSource.transaction(async (em) => {
      const workflow = em.create(Workflow, {
        name: dto.name,
        entityType: dto.entityType,
        isActive: dto.isActive ?? true,
      });
      const saved = await em.save(Workflow, workflow);

      if (dto.steps?.length) {
        const steps = dto.steps.map((s) =>
          em.create(WorkflowStep, {
            workflowId: saved.id,
            stepOrder: s.stepOrder,
            approverType: s.approverType,
            approverRef: s.approverRef ?? null,
            isMandatory: s.isMandatory ?? true,
            slaHours: s.slaHours ?? null,
            minMetricValue: s.minMetricValue != null ? String(s.minMetricValue) : null,
            maxMetricValue: s.maxMetricValue != null ? String(s.maxMetricValue) : null,
          }),
        );
        await em.save(WorkflowStep, steps);
      }

      return em.findOne(Workflow, {
        where: { id: saved.id },
        relations: ['steps'],
      });
    });
  }

  async setWorkflowActive(id: string, isActive: boolean) {
    const workflow = await this.workflowRepo.findOne({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow not found');

    if (isActive) {
      await this.dataSource.transaction(async (em) => {
        await em.update(
          Workflow,
          { entityType: workflow.entityType, id: Not(id) },
          { isActive: false },
        );
        await em.update(Workflow, { id }, { isActive: true });
      });
    } else {
      await this.workflowRepo.update({ id }, { isActive: false });
    }

    return this.workflowRepo.findOne({ where: { id }, relations: ['steps'] });
  }

  async addStep(workflowId: string, dto: CreateWorkflowStepDto) {
    const workflow = await this.workflowRepo.findOne({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    await this.validateApproverRef(dto.approverType, dto.approverRef ?? null);

    const step = this.stepRepo.create({
      workflowId,
      stepOrder: dto.stepOrder,
      approverType: dto.approverType,
      approverRef: dto.approverRef ?? null,
      isMandatory: dto.isMandatory ?? true,
      slaHours: dto.slaHours ?? null,
      minMetricValue: dto.minMetricValue != null ? String(dto.minMetricValue) : null,
      maxMetricValue: dto.maxMetricValue != null ? String(dto.maxMetricValue) : null,
    });
    return this.stepRepo.save(step);
  }

  async updateStep(workflowId: string, stepId: string, dto: UpdateWorkflowStepDto) {
    const step = await this.stepRepo.findOne({ where: { id: stepId, workflowId } });
    if (!step) throw new NotFoundException('Workflow step not found');

    const nextApproverType = dto.approverType ?? step.approverType;
    const nextApproverRef = dto.approverRef !== undefined ? dto.approverRef : step.approverRef;
    await this.validateApproverRef(nextApproverType, nextApproverRef);

    Object.assign(step, {
      ...(dto.stepOrder !== undefined && { stepOrder: dto.stepOrder }),
      ...(dto.approverType !== undefined && { approverType: dto.approverType }),
      ...(dto.approverRef !== undefined && { approverRef: dto.approverRef }),
      ...(dto.isMandatory !== undefined && { isMandatory: dto.isMandatory }),
      ...(dto.slaHours !== undefined && { slaHours: dto.slaHours }),
      ...(dto.minMetricValue !== undefined && {
        minMetricValue: dto.minMetricValue != null ? String(dto.minMetricValue) : null,
      }),
      ...(dto.maxMetricValue !== undefined && {
        maxMetricValue: dto.maxMetricValue != null ? String(dto.maxMetricValue) : null,
      }),
    });
    return this.stepRepo.save(step);
  }

  async removeStep(workflowId: string, stepId: string) {
    const step = await this.stepRepo.findOne({ where: { id: stepId, workflowId } });
    if (!step) throw new NotFoundException('Workflow step not found');

    const remaining = await this.stepRepo.count({ where: { workflowId } });
    if (remaining <= 1) {
      throw new BadRequestException('A workflow must keep at least one step');
    }
    await this.stepRepo.delete({ id: stepId });
    return { deleted: true };
  }

  async reorderSteps(workflowId: string, stepIds: string[]) {
    const steps = await this.stepRepo.find({ where: { workflowId } });
    if (steps.length !== stepIds.length || steps.some((s) => !stepIds.includes(s.id))) {
      throw new BadRequestException('stepIds must match the workflow\'s existing steps exactly');
    }

    await this.dataSource.transaction(async (em) => {
      for (let i = 0; i < stepIds.length; i++) {
        await em.update(WorkflowStep, { id: stepIds[i] }, { stepOrder: i + 1 });
      }
    });
    return this.stepRepo.find({ where: { workflowId }, order: { stepOrder: 'ASC' } });
  }

  private async validateApproverRef(
    approverType: ApproverType,
    approverRef: string | null,
  ): Promise<void> {
    if (approverType === ApproverType.Role) {
      if (!approverRef) throw new BadRequestException('approverRef (role id) is required for approverType "role"');
      const role = await this.roleRepo.findOne({ where: { id: approverRef } });
      if (!role) throw new BadRequestException(`No role found with id ${approverRef}`);
    }
    if (approverType === ApproverType.ManagerChainLevel) {
      const level = approverRef != null ? parseInt(approverRef, 10) : 1;
      if (!approverRef || Number.isNaN(level) || level < 1) {
        throw new BadRequestException('approverRef must be a positive integer level for approverType "manager_chain_level"');
      }
    }
  }

  // ── Engine ──────────────────────────────────────────────────────────────────

  async start(params: StartApprovalParams): Promise<Approval> {
    const workflow = await this.workflowRepo.findOne({
      where: { entityType: params.entityType, isActive: true },
      relations: ['steps'],
    });

    if (!workflow) {
      throw new NotFoundException(
        `No active workflow configured for ${params.entityType}`,
      );
    }

    const steps = (workflow.steps ?? []).sort((a, b) => a.stepOrder - b.stepOrder);
    const metricValue = params.metricValue ?? null;
    const next = await this.findNextActionableStep(steps, 0, metricValue, params.requesterId);

    const approval = this.approvalRepo.create({
      workflowId: workflow.id,
      entityType: params.entityType,
      entityId: params.entityId,
      currentStep: next?.step.stepOrder ?? steps[0]?.stepOrder ?? 1,
      status: next ? ApprovalStatus.Pending : ApprovalStatus.Approved,
      requestedBy: params.requesterId,
      metricValue: metricValue != null ? String(metricValue) : null,
    });

    const saved = await this.approvalRepo.save(approval);

    if (next) {
      this.eventEmitter.emit('approval.pending', {
        entityType: saved.entityType,
        entityId: saved.entityId,
        approvalId: saved.id,
        currentStep: saved.currentStep,
        approverIds: next.approverIds,
      } as ApprovalPendingEvent);
    } else {
      this.eventEmitter.emit('approval.approved', {
        entityType: saved.entityType,
        entityId: saved.entityId,
        approvalId: saved.id,
        status: ApprovalStatus.Approved,
        requestedBy: saved.requestedBy,
      } as ApprovalFinalizedEvent);
    }

    return saved;
  }

  async act(approvalId: string, actorId: string, dto: ActApprovalDto): Promise<Approval> {
    const approval = await this.approvalRepo.findOne({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval not found');

    if (approval.status !== ApprovalStatus.Pending) {
      throw new BadRequestException(`Approval is already ${approval.status}`);
    }

    if (dto.action !== ApprovalActionType.Comment) {
      const canAct = await this.checkCanAct(approval, actorId);
      if (!canAct) throw new ForbiddenException('You are not an approver for this step');
    }

    // Record action — append-only, never update this table
    await this.actionRepo.save(
      this.actionRepo.create({
        approvalId,
        stepOrder: approval.currentStep,
        actorId,
        action: dto.action,
        comment: dto.comment ?? null,
        approvedAmount: dto.approvedAmount != null ? String(dto.approvedAmount) : null,
      }),
    );

    if (dto.action === ApprovalActionType.Approve && dto.approvedAmount != null) {
      approval.approvedAmount = String(dto.approvedAmount);
    }

    if (dto.action === ApprovalActionType.Reject) {
      approval.status = ApprovalStatus.Rejected;
      const saved = await this.approvalRepo.save(approval);
      this.eventEmitter.emit('approval.rejected', {
        entityType: approval.entityType,
        entityId: approval.entityId,
        approvalId: approval.id,
        status: ApprovalStatus.Rejected,
        requestedBy: approval.requestedBy,
      } as ApprovalFinalizedEvent);
      return saved;
    }

    if (dto.action === ApprovalActionType.Return) {
      const workflow = await this.workflowRepo.findOne({
        where: { id: approval.workflowId },
        relations: ['steps'],
      });
      const steps = (workflow?.steps ?? []).sort((a, b) => a.stepOrder - b.stepOrder);
      const metricValue = approval.metricValue != null ? Number(approval.metricValue) : null;
      const next = await this.findNextActionableStep(steps, 0, metricValue, approval.requestedBy);
      approval.currentStep = next?.step.stepOrder ?? steps[0]?.stepOrder ?? 1;
      const saved = await this.approvalRepo.save(approval);
      this.eventEmitter.emit('approval.returned', {
        entityType: approval.entityType,
        entityId: approval.entityId,
        approvalId: approval.id,
        requestedBy: approval.requestedBy,
      } as ApprovalReturnedEvent);
      return saved;
    }

    if (dto.action === ApprovalActionType.Comment) {
      return approval;
    }

    // Approve: advance or finalize
    const workflow = await this.workflowRepo.findOne({
      where: { id: approval.workflowId },
      relations: ['steps'],
    });
    const steps = (workflow?.steps ?? []).sort((a, b) => a.stepOrder - b.stepOrder);
    const metricValue = approval.metricValue != null ? Number(approval.metricValue) : null;
    const next = await this.findNextActionableStep(
      steps,
      approval.currentStep,
      metricValue,
      approval.requestedBy,
    );

    if (next) {
      approval.currentStep = next.step.stepOrder;
      const saved = await this.approvalRepo.save(approval);
      this.eventEmitter.emit('approval.pending', {
        entityType: saved.entityType,
        entityId: saved.entityId,
        approvalId: saved.id,
        currentStep: saved.currentStep,
        approverIds: next.approverIds,
      } as ApprovalPendingEvent);
      return saved;
    }

    approval.status = ApprovalStatus.Approved;
    const saved = await this.approvalRepo.save(approval);
    this.eventEmitter.emit('approval.approved', {
      entityType: approval.entityType,
      entityId: approval.entityId,
      approvalId: approval.id,
      status: ApprovalStatus.Approved,
      requestedBy: approval.requestedBy,
      approvedAmount: approval.approvedAmount != null ? Number(approval.approvedAmount) : undefined,
    } as ApprovalFinalizedEvent);
    return saved;
  }

  async cancelApproval(approvalId: string): Promise<void> {
    const approval = await this.approvalRepo.findOne({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== ApprovalStatus.Pending) {
      throw new BadRequestException('Only pending approvals can be cancelled');
    }
    await this.approvalRepo.update({ id: approvalId }, { status: ApprovalStatus.Cancelled });
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getMyPendingApprovals(userId: string): Promise<Approval[]> {
    const pending = await this.approvalRepo.find({
      where: { status: ApprovalStatus.Pending },
      relations: ['workflow', 'workflow.steps', 'requester'],
      order: { createdAt: 'ASC' },
    });

    const mine: Approval[] = [];
    for (const approval of pending) {
      const step = (approval.workflow?.steps ?? []).find(
        (s) => s.stepOrder === approval.currentStep,
      );
      if (!step) continue;
      const approverIds = await this.resolveApprover(step, approval.requestedBy);
      if (approverIds.includes(userId)) mine.push(approval);
    }
    return mine;
  }

  async getApprovalById(id: string): Promise<Approval> {
    const approval = await this.approvalRepo.findOne({
      where: { id },
      relations: ['workflow', 'workflow.steps', 'actions', 'requester'],
      order: { actions: { actedAt: 'ASC' } } as never,
    });
    if (!approval) throw new NotFoundException('Approval not found');
    return approval;
  }

  async getApprovalForEntity(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<Approval | null> {
    return this.approvalRepo.findOne({
      where: { entityType, entityId },
      relations: ['workflow', 'workflow.steps', 'actions', 'requester'],
      order: { createdAt: 'DESC' },
    });
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async checkCanAct(approval: Approval, actorId: string): Promise<boolean> {
    const workflow = await this.workflowRepo.findOne({
      where: { id: approval.workflowId },
      relations: ['steps'],
    });
    const step = (workflow?.steps ?? []).find((s) => s.stepOrder === approval.currentStep);
    if (!step) return false;
    const ids = await this.resolveApprover(step, approval.requestedBy);
    return ids.includes(actorId);
  }

  private async resolveApprover(step: WorkflowStep, requesterId: string): Promise<string[]> {
    switch (step.approverType) {
      case ApproverType.SpecificUser:
        return step.approverRef ? [step.approverRef] : [];

      case ApproverType.LineManager: {
        const emp = await this.employeeRepo.findOne({ where: { userId: requesterId } });
        if (!emp?.lineManagerId) return [];
        const mgr = await this.employeeRepo.findOne({ where: { id: emp.lineManagerId } });
        return mgr?.userId ? [mgr.userId] : [];
      }

      case ApproverType.DepartmentHead: {
        const emp = await this.employeeRepo.findOne({ where: { userId: requesterId } });
        if (!emp?.departmentId) return [];
        const dept = await this.departmentRepo.findOne({ where: { id: emp.departmentId } });
        if (!dept?.headEmployeeId) return [];
        const head = await this.employeeRepo.findOne({ where: { id: dept.headEmployeeId } });
        return head?.userId ? [head.userId] : [];
      }

      case ApproverType.Role: {
        if (!step.approverRef) return [];
        const users = await this.dataSource
          .getRepository(User)
          .createQueryBuilder('u')
          .innerJoin('u.roles', 'r', 'r.id = :roleId', { roleId: step.approverRef })
          .select('u.id')
          .getMany();
        return users.map((u) => u.id);
      }

      case ApproverType.ManagerChainLevel: {
        const level = Math.max(1, parseInt(step.approverRef ?? '1', 10) || 1);
        let currentUserId: string | null = requesterId;
        for (let i = 0; i < level; i++) {
          if (!currentUserId) return [];
          const emp = await this.employeeRepo.findOne({ where: { userId: currentUserId } });
          if (!emp?.lineManagerId) return [];
          const mgr = await this.employeeRepo.findOne({ where: { id: emp.lineManagerId } });
          currentUserId = mgr?.userId ?? null;
        }
        return currentUserId ? [currentUserId] : [];
      }

      default:
        return [];
    }
  }

  private stepApplies(step: WorkflowStep, metricValue: number | null): boolean {
    const min = step.minMetricValue != null ? Number(step.minMetricValue) : null;
    const max = step.maxMetricValue != null ? Number(step.maxMetricValue) : null;
    if (min == null && max == null) return true;
    if (metricValue == null) return false;
    if (min != null && metricValue < min) return false;
    if (max != null && metricValue > max) return false;
    return true;
  }

  private async findNextActionableStep(
    steps: WorkflowStep[],
    afterOrder: number,
    metricValue: number | null,
    requesterId: string,
  ): Promise<{ step: WorkflowStep; approverIds: string[] } | null> {
    const candidates = steps
      .filter((s) => s.stepOrder > afterOrder && s.isMandatory && this.stepApplies(s, metricValue))
      .sort((a, b) => a.stepOrder - b.stepOrder);
    for (const step of candidates) {
      const approverIds = await this.resolveApprover(step, requesterId);
      if (approverIds.length > 0) return { step, approverIds };
    }
    return null;
  }
}
