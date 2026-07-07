import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalEntityType, ExpenseClaimStatus, ChangeEntityType, AttachmentOwnerType } from '@hrm/types';
import { ExpenseClaim } from '../../database/entities/travel/expense-claim.entity';
import { ExpenseItem } from '../../database/entities/travel/expense-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { ApprovalsService, ApprovalFinalizedEvent } from '../approvals/approvals.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ChangeLogService } from '../change-log/change-log.service';
import { restartApproval } from '../../common/utils/restart-approval.util';
import { CreateExpenseClaimDto } from './dto/create-expense-claim.dto';
import { UpdateExpenseClaimDto } from './dto/update-expense-claim.dto';
import { ReimburseExpenseDto } from './dto/reimburse-expense.dto';

const EDITABLE_STATUSES = [ExpenseClaimStatus.Draft, ExpenseClaimStatus.Pending, ExpenseClaimStatus.Approved];

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(ExpenseClaim) private claimRepo: Repository<ExpenseClaim>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private approvalsService: ApprovalsService,
    private attachmentsService: AttachmentsService,
    private changeLogService: ChangeLogService,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Claims ──────────────────────────────────────────────────────────────────

  async createExpenseClaim(userId: string, dto: CreateExpenseClaimDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);

    return this.dataSource.transaction(async (em) => {
      const claim = await em.save(ExpenseClaim, em.create(ExpenseClaim, {
        employeeId: employee.id,
        travelRequestId: dto.travelRequestId ?? null,
        title: dto.title,
        totalAmount,
        status: ExpenseClaimStatus.Pending,
        approvalId: null,
      }));

      for (const item of dto.items) {
        const saved = await em.save(ExpenseItem, em.create(ExpenseItem, {
          expenseClaimId: claim.id,
          description: item.description,
          amount: item.amount,
          spentOn: item.spentOn,
        }));
        await this.attachmentsService.createAttachments(
          em, AttachmentOwnerType.ExpenseItem, saved.id, userId, item.attachments,
        );
      }

      const approval = await this.approvalsService.start({
        entityType: ApprovalEntityType.ExpenseClaim,
        entityId: claim.id,
        requesterId: userId,
        metricValue: totalAmount,
      });

      await em.update(ExpenseClaim, { id: claim.id }, { approvalId: approval.id });
      claim.approvalId = approval.id;

      return claim;
    });
  }

  async updateExpenseClaim(id: string, userId: string, dto: UpdateExpenseClaimDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const claim = await this.claimRepo.findOne({ where: { id }, relations: ['items'] });
    if (!claim) throw new NotFoundException('Expense claim not found');
    if (claim.employeeId !== employee.id) {
      throw new ForbiddenException('You can only edit your own expense claims');
    }
    if (!EDITABLE_STATUSES.includes(claim.status)) {
      throw new BadRequestException(`Cannot edit an expense claim with status "${claim.status}"`);
    }

    const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);
    const oldItemsById = new Map(claim.items.map((i) => [i.id, i]));
    const newIds = new Set(dto.items.filter((i) => i.id).map((i) => i.id as string));
    const diffLines: string[] = [];

    return this.dataSource.transaction(async (em) => {
      for (const old of claim.items) {
        if (!newIds.has(old.id)) {
          diffLines.push(`Removed item "${old.description}" ($${Number(old.amount).toFixed(2)})`);
          await em.delete(ExpenseItem, { id: old.id });
        }
      }

      for (const item of dto.items) {
        if (item.id && oldItemsById.has(item.id)) {
          const old = oldItemsById.get(item.id)!;
          if (Number(old.amount) !== item.amount || old.description !== item.description) {
            diffLines.push(`Updated "${item.description}": $${Number(old.amount).toFixed(2)} → $${item.amount.toFixed(2)}`);
          }
          await em.update(ExpenseItem, { id: item.id }, {
            description: item.description,
            amount: item.amount,
            spentOn: item.spentOn,
          });
          await this.attachmentsService.createAttachments(
            em, AttachmentOwnerType.ExpenseItem, item.id, userId, item.attachments,
          );
        } else {
          const saved = await em.save(ExpenseItem, em.create(ExpenseItem, {
            expenseClaimId: id,
            description: item.description,
            amount: item.amount,
            spentOn: item.spentOn,
          }));
          diffLines.push(`Added item "${item.description}" ($${item.amount.toFixed(2)})`);
          await this.attachmentsService.createAttachments(
            em, AttachmentOwnerType.ExpenseItem, saved.id, userId, item.attachments,
          );
        }
      }

      await em.update(ExpenseClaim, { id }, {
        title: dto.title ?? claim.title,
        totalAmount,
        status: ExpenseClaimStatus.Pending,
      });

      const approval = await restartApproval(this.approvalsService, {
        entityType: ApprovalEntityType.ExpenseClaim,
        entityId: id,
        requesterId: userId,
        metricValue: totalAmount,
        previousApprovalId: claim.approvalId,
      });
      await em.update(ExpenseClaim, { id }, { approvalId: approval.id });

      if (diffLines.length) {
        await this.changeLogService.record(
          em, ChangeEntityType.ExpenseClaim, id, userId,
          `Claim edited — ${diffLines.join('; ')}`, { items: diffLines },
        );
      }

      return em.findOne(ExpenseClaim, { where: { id }, relations: ['items'] });
    });
  }

  async getChangeLog(id: string) {
    return this.changeLogService.findForEntity(ChangeEntityType.ExpenseClaim, id);
  }

  async cancelExpenseClaim(id: string, userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const claim = await this.claimRepo.findOne({ where: { id } });
    if (!claim) throw new NotFoundException('Expense claim not found');

    if (claim.employeeId !== employee.id) {
      throw new ForbiddenException('You can only cancel your own expense claims');
    }

    if (![ExpenseClaimStatus.Draft, ExpenseClaimStatus.Pending].includes(claim.status)) {
      throw new BadRequestException(`Cannot cancel an expense claim with status "${claim.status}"`);
    }

    await this.claimRepo.update({ id }, { status: ExpenseClaimStatus.Cancelled });

    if (claim.approvalId) {
      await this.approvalsService.cancelApproval(claim.approvalId).catch(() => undefined);
    }
  }

  async reimburseExpenseClaim(id: string, dto: ReimburseExpenseDto) {
    const claim = await this.claimRepo.findOne({ where: { id } });
    if (!claim) throw new NotFoundException('Expense claim not found');

    if (claim.status !== ExpenseClaimStatus.Approved) {
      throw new BadRequestException('Only approved expense claims can be marked reimbursed');
    }

    await this.claimRepo.update(
      { id },
      {
        status: ExpenseClaimStatus.Reimbursed,
        reimbursedAt: new Date(),
        reimbursementRef: dto.reimbursementRef,
      },
    );

    const employee = await this.employeeRepo.findOne({ where: { id: claim.employeeId } });
    if (employee) {
      this.eventEmitter.emit('expense.reimbursed', {
        claimId: id,
        userId: employee.userId,
        reimbursementRef: dto.reimbursementRef,
      });
    }

    return this.claimRepo.findOne({ where: { id } });
  }

  async getMyExpenseClaims(userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return this.claimRepo.find({
      where: { employeeId: employee.id },
      relations: ['items', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllExpenseClaims(status?: string) {
    return this.claimRepo.find({
      where: status ? { status: status as ExpenseClaimStatus } : {},
      relations: ['items', 'employee', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getReimbursableExpenseClaims() {
    return this.claimRepo.find({
      where: { status: ExpenseClaimStatus.Approved },
      relations: ['items', 'employee'],
      order: { updatedAt: 'ASC' },
    });
  }

  async getExpenseClaimById(id: string, userId: string, canViewAll: boolean) {
    const claim = await this.claimRepo.findOne({
      where: { id },
      relations: ['items', 'employee', 'approval', 'approval.workflow', 'approval.workflow.steps', 'approval.actions'],
    });
    if (!claim) throw new NotFoundException('Expense claim not found');

    if (!canViewAll) {
      const employee = await this.employeeRepo.findOne({ where: { userId } });
      if (!employee || claim.employeeId !== employee.id) {
        throw new ForbiddenException('You do not have access to this expense claim');
      }
    }

    return claim;
  }

  // ── Approval event listeners ────────────────────────────────────────────────

  @OnEvent('approval.approved')
  async handleApprovalApproved(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.ExpenseClaim) return;
    const claim = await this.claimRepo.findOne({ where: { id: event.entityId } });
    await this.claimRepo.update({ id: event.entityId }, {
      status: ExpenseClaimStatus.Approved,
      approvedAmount: event.approvedAmount ?? claim?.totalAmount ?? 0,
    });
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.ExpenseClaim) return;
    await this.claimRepo.update({ id: event.entityId }, { status: ExpenseClaimStatus.Rejected });
  }
}
