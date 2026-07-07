import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { ApprovalEntityType, RequisitionStatus } from '@hrm/types';
import { Requisition } from '../../database/entities/requisitions/requisition.entity';
import { RequisitionItem } from '../../database/entities/requisitions/requisition-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { ApprovalsService, ApprovalFinalizedEvent } from '../approvals/approvals.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';

@Injectable()
export class RequisitionsService {
  constructor(
    @InjectRepository(Requisition) private requisitionRepo: Repository<Requisition>,
    @InjectRepository(RequisitionItem) private itemRepo: Repository<RequisitionItem>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private approvalsService: ApprovalsService,
    private dataSource: DataSource,
  ) {}

  async createRequisition(userId: string, dto: CreateRequisitionDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const estimatedCost = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    );

    return this.dataSource.transaction(async (em) => {
      // Create the requisition first so the approval has a real entity id to reference
      // (Approval.entityId is a uuid column — it cannot hold a placeholder value).
      const requisition = await em.save(Requisition, em.create(Requisition, {
        requesterId: employee.id,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority,
        neededBy: dto.neededBy ?? null,
        estimatedCost,
        status: RequisitionStatus.Pending,
        approvalId: null,
      }));

      await em.save(
        RequisitionItem,
        dto.items.map((item) =>
          em.create(RequisitionItem, {
            requisitionId: requisition.id,
            name: item.name,
            quantity: item.quantity,
            unitCost: item.unitCost,
            note: item.note ?? null,
          }),
        ),
      );

      const approval = await this.approvalsService.start({
        entityType: ApprovalEntityType.Requisition,
        entityId: requisition.id,
        requesterId: userId,
        metricValue: estimatedCost,
      });

      await em.update(Requisition, { id: requisition.id }, { approvalId: approval.id });
      requisition.approvalId = approval.id;

      return requisition;
    });
  }

  async cancelRequisition(id: string, userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const requisition = await this.requisitionRepo.findOne({ where: { id } });
    if (!requisition) throw new NotFoundException('Requisition not found');

    if (requisition.requesterId !== employee.id) {
      throw new ForbiddenException('You can only cancel your own requisitions');
    }

    if (![RequisitionStatus.Draft, RequisitionStatus.Pending].includes(requisition.status)) {
      throw new BadRequestException(`Cannot cancel a requisition with status "${requisition.status}"`);
    }

    await this.requisitionRepo.update({ id }, { status: RequisitionStatus.Cancelled });

    if (requisition.approvalId) {
      await this.approvalsService.cancelApproval(requisition.approvalId).catch(() => undefined);
    }
  }

  async getMyRequisitions(userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return this.requisitionRepo.find({
      where: { requesterId: employee.id },
      relations: ['items', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllRequisitions(status?: string) {
    return this.requisitionRepo.find({
      where: status ? { status: status as RequisitionStatus } : {},
      relations: ['items', 'requester', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getRequisitionById(id: string, userId: string, canViewAll: boolean) {
    const requisition = await this.requisitionRepo.findOne({
      where: { id },
      relations: ['items', 'requester', 'approval', 'approval.workflow', 'approval.workflow.steps', 'approval.actions'],
    });
    if (!requisition) throw new NotFoundException('Requisition not found');

    if (!canViewAll) {
      const employee = await this.employeeRepo.findOne({ where: { userId } });
      if (!employee || requisition.requesterId !== employee.id) {
        throw new ForbiddenException('You do not have access to this requisition');
      }
    }

    return requisition;
  }

  // ── Approval event listeners ────────────────────────────────────────────────

  @OnEvent('approval.approved')
  async handleApprovalApproved(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.Requisition) return;
    await this.requisitionRepo.update({ id: event.entityId }, { status: RequisitionStatus.Approved });
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.Requisition) return;
    await this.requisitionRepo.update({ id: event.entityId }, { status: RequisitionStatus.Rejected });
  }
}
