import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApprovalEntityType,
  TravelRequestStatus,
  TravelRequestTiming,
  TravelSettlementStatus,
  ChangeEntityType,
  AttachmentOwnerType,
  TravelCostCategory,
} from '@hrm/types';
import { TravelRequest } from '../../database/entities/travel/travel-request.entity';
import { TravelRequestItem } from '../../database/entities/travel/travel-request-item.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { ApprovalsService, ApprovalFinalizedEvent } from '../approvals/approvals.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { ChangeLogService } from '../change-log/change-log.service';
import { restartApproval } from '../../common/utils/restart-approval.util';
import { CreateTravelRequestDto } from './dto/create-travel-request.dto';
import { UpdateTravelRequestDto } from './dto/update-travel-request.dto';
import { SubmitSettlementDto } from './dto/submit-settlement.dto';
import { ReimburseTravelDto } from './dto/reimburse-travel.dto';

const EDITABLE_STATUSES = [TravelRequestStatus.Draft, TravelRequestStatus.Pending, TravelRequestStatus.Approved];

@Injectable()
export class TravelService {
  constructor(
    @InjectRepository(TravelRequest) private travelRepo: Repository<TravelRequest>,
    @InjectRepository(TravelRequestItem) private itemRepo: Repository<TravelRequestItem>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private approvalsService: ApprovalsService,
    private attachmentsService: AttachmentsService,
    private changeLogService: ChangeLogService,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
  ) {}

  async createTravelRequest(userId: string, dto: CreateTravelRequestDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    if (new Date(dto.toDate) < new Date(dto.fromDate)) {
      throw new BadRequestException('End date must be on or after start date');
    }
    for (const item of dto.items) {
      if (new Date(item.toDate) < new Date(item.fromDate)) {
        throw new BadRequestException(`"${item.description}": end date must be on or after start date`);
      }
    }

    const timing = dto.timing ?? TravelRequestTiming.PreTrip;
    if (timing === TravelRequestTiming.PostTrip) {
      const today = new Date().toISOString().slice(0, 10);
      if (dto.toDate > today) {
        throw new BadRequestException('A post-trip request is for a trip that already happened — the end date cannot be in the future');
      }
    }
    // Post-trip requests are reimbursed directly once approved — never advanced.
    const advanceRequested = timing === TravelRequestTiming.PostTrip ? 0 : (dto.advanceRequested ?? 0);

    const estimatedCost = dto.items.reduce((sum, item) => sum + item.estimatedCost, 0);

    return this.dataSource.transaction(async (em) => {
      // Create the travel request first so the approval has a real entity id to reference
      // (Approval.entityId is a uuid column — it cannot hold a placeholder value).
      const travelRequest = await em.save(TravelRequest, em.create(TravelRequest, {
        employeeId: employee.id,
        purpose: dto.purpose,
        timing,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        estimatedCost,
        advanceRequested,
        status: TravelRequestStatus.Pending,
        approvalId: null,
      }));

      for (const item of dto.items) {
        const saved = await em.save(TravelRequestItem, em.create(TravelRequestItem, {
          travelRequestId: travelRequest.id,
          description: item.description,
          category: item.category,
          transportMode: item.transportMode ?? null,
          fromLocation: item.category === TravelCostCategory.Travel ? (item.fromLocation ?? null) : null,
          toLocation: item.category === TravelCostCategory.Travel ? (item.toLocation ?? null) : null,
          isRoundTrip: item.category === TravelCostCategory.Travel ? (item.isRoundTrip ?? false) : false,
          fromDate: item.fromDate,
          toDate: item.toDate,
          estimatedCost: item.estimatedCost,
          note: item.note ?? null,
        }));
        await this.attachmentsService.createAttachments(
          em, AttachmentOwnerType.TravelRequestItem, saved.id, userId, item.attachments,
        );
      }

      const approval = await this.approvalsService.start({
        entityType: ApprovalEntityType.TravelRequest,
        entityId: travelRequest.id,
        requesterId: userId,
        metricValue: estimatedCost,
      });

      await em.update(TravelRequest, { id: travelRequest.id }, { approvalId: approval.id });
      travelRequest.approvalId = approval.id;

      return travelRequest;
    });
  }

  async updateTravelRequest(id: string, userId: string, dto: UpdateTravelRequestDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const travelRequest = await this.travelRepo.findOne({ where: { id }, relations: ['items'] });
    if (!travelRequest) throw new NotFoundException('Travel request not found');
    if (travelRequest.employeeId !== employee.id) {
      throw new ForbiddenException('You can only edit your own travel requests');
    }
    if (!EDITABLE_STATUSES.includes(travelRequest.status)) {
      throw new BadRequestException(`Cannot edit a travel request with status "${travelRequest.status}"`);
    }
    if (travelRequest.settlementStatus !== TravelSettlementStatus.None) {
      throw new BadRequestException(
        'This trip already has a settlement in progress — submit further changes through the settlement instead',
      );
    }

    const fromDate = dto.fromDate ?? travelRequest.fromDate;
    const toDate = dto.toDate ?? travelRequest.toDate;
    if (new Date(toDate) < new Date(fromDate)) {
      throw new BadRequestException('End date must be on or after start date');
    }
    for (const item of dto.items) {
      if (new Date(item.toDate) < new Date(item.fromDate)) {
        throw new BadRequestException(`"${item.description}": end date must be on or after start date`);
      }
    }
    if (travelRequest.timing === TravelRequestTiming.PostTrip) {
      const today = new Date().toISOString().slice(0, 10);
      if (toDate > today) {
        throw new BadRequestException('A post-trip request is for a trip that already happened — the end date cannot be in the future');
      }
    }
    // Timing is fixed at creation; a post-trip request never carries an advance.
    const advanceRequested = travelRequest.timing === TravelRequestTiming.PostTrip ? 0 : (dto.advanceRequested ?? travelRequest.advanceRequested);

    const estimatedCost = dto.items.reduce((sum, item) => sum + item.estimatedCost, 0);
    const oldItemsById = new Map(travelRequest.items.map((i) => [i.id, i]));
    const newIds = new Set(dto.items.filter((i) => i.id).map((i) => i.id as string));
    const diffLines: string[] = [];

    return this.dataSource.transaction(async (em) => {
      for (const old of travelRequest.items) {
        if (!newIds.has(old.id)) {
          diffLines.push(`Removed ${old.category} item "${old.description}" ($${Number(old.estimatedCost).toFixed(2)})`);
          await em.delete(TravelRequestItem, { id: old.id });
        }
      }

      for (const item of dto.items) {
        const isTransport = item.category === TravelCostCategory.Travel;
        if (item.id && oldItemsById.has(item.id)) {
          const old = oldItemsById.get(item.id)!;
          if (
            Number(old.estimatedCost) !== item.estimatedCost
            || old.description !== item.description
            || old.category !== item.category
          ) {
            diffLines.push(
              `Updated "${item.description}": $${Number(old.estimatedCost).toFixed(2)} → $${item.estimatedCost.toFixed(2)}`,
            );
          }
          await em.update(TravelRequestItem, { id: item.id }, {
            description: item.description,
            category: item.category,
            transportMode: item.transportMode ?? null,
            fromLocation: isTransport ? (item.fromLocation ?? null) : null,
            toLocation: isTransport ? (item.toLocation ?? null) : null,
            isRoundTrip: isTransport ? (item.isRoundTrip ?? false) : false,
            fromDate: item.fromDate,
            toDate: item.toDate,
            estimatedCost: item.estimatedCost,
            note: item.note ?? null,
          });
          await this.attachmentsService.createAttachments(
            em, AttachmentOwnerType.TravelRequestItem, item.id, userId, item.attachments,
          );
        } else {
          const saved = await em.save(TravelRequestItem, em.create(TravelRequestItem, {
            travelRequestId: id,
            description: item.description,
            category: item.category,
            transportMode: item.transportMode ?? null,
            fromLocation: isTransport ? (item.fromLocation ?? null) : null,
            toLocation: isTransport ? (item.toLocation ?? null) : null,
            isRoundTrip: isTransport ? (item.isRoundTrip ?? false) : false,
            fromDate: item.fromDate,
            toDate: item.toDate,
            estimatedCost: item.estimatedCost,
            note: item.note ?? null,
          }));
          diffLines.push(`Added ${item.category} item "${item.description}" ($${item.estimatedCost.toFixed(2)})`);
          await this.attachmentsService.createAttachments(
            em, AttachmentOwnerType.TravelRequestItem, saved.id, userId, item.attachments,
          );
        }
      }

      await em.update(TravelRequest, { id }, {
        purpose: dto.purpose ?? travelRequest.purpose,
        fromDate,
        toDate,
        advanceRequested,
        estimatedCost,
        status: TravelRequestStatus.Pending,
      });

      const approval = await restartApproval(this.approvalsService, {
        entityType: ApprovalEntityType.TravelRequest,
        entityId: id,
        requesterId: userId,
        metricValue: estimatedCost,
        previousApprovalId: travelRequest.approvalId,
      });
      await em.update(TravelRequest, { id }, { approvalId: approval.id });

      if (diffLines.length) {
        await this.changeLogService.record(
          em, ChangeEntityType.TravelRequest, id, userId,
          `Trip edited — ${diffLines.join('; ')}`, { items: diffLines },
        );
      }

      return em.findOne(TravelRequest, { where: { id }, relations: ['items'] });
    });
  }

  async submitSettlement(tripId: string, userId: string, dto: SubmitSettlementDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const travelRequest = await this.travelRepo.findOne({ where: { id: tripId }, relations: ['items'] });
    if (!travelRequest) throw new NotFoundException('Travel request not found');
    if (travelRequest.employeeId !== employee.id) {
      throw new ForbiddenException('You can only settle your own travel requests');
    }
    if (travelRequest.status !== TravelRequestStatus.Approved) {
      throw new BadRequestException('Only an approved travel request can be settled');
    }
    if (travelRequest.timing === TravelRequestTiming.PostTrip) {
      throw new BadRequestException(
        'This is a post-trip request — there is no advance to settle. It is reimbursed directly once approved.',
      );
    }
    if (travelRequest.settlementStatus === TravelSettlementStatus.Locked) {
      // Not forbidden outright — resubmitting reopens it and restarts approval, per the
      // "editing requires going through approval again" rule. Just surface that clearly.
      travelRequest.settlementStatus = TravelSettlementStatus.None;
    }

    const oldItemsById = new Map(travelRequest.items.map((i) => [i.id, i]));
    const diffLines: string[] = [];
    let actualCost = 0;

    return this.dataSource.transaction(async (em) => {
      for (const line of dto.items) {
        actualCost += line.actualCost;

        if (line.itemId && oldItemsById.has(line.itemId)) {
          const old = oldItemsById.get(line.itemId)!;
          const prevActual = old.actualCost != null ? Number(old.actualCost) : Number(old.estimatedCost);
          if (prevActual !== line.actualCost) {
            diffLines.push(`"${old.description}" actual cost: $${prevActual.toFixed(2)} → $${line.actualCost.toFixed(2)}`);
          }
          await em.update(TravelRequestItem, { id: line.itemId }, {
            actualCost: line.actualCost,
            note: line.note ?? old.note,
          });
          await this.attachmentsService.createAttachments(
            em, AttachmentOwnerType.TravelRequestItem, line.itemId, userId, line.attachments,
          );
        } else {
          if (!line.description) {
            throw new BadRequestException('description is required for an unplanned settlement cost');
          }
          const unplannedFromDate = line.fromDate ?? travelRequest.toDate;
          const unplannedCategory = line.category ?? TravelCostCategory.Misc;
          const isTransport = unplannedCategory === TravelCostCategory.Travel;
          const saved = await em.save(TravelRequestItem, em.create(TravelRequestItem, {
            travelRequestId: tripId,
            description: line.description,
            category: unplannedCategory,
            transportMode: null,
            fromLocation: isTransport ? (line.fromLocation ?? null) : null,
            toLocation: isTransport ? (line.toLocation ?? null) : null,
            isRoundTrip: isTransport ? (line.isRoundTrip ?? false) : false,
            fromDate: unplannedFromDate,
            toDate: line.toDate ?? unplannedFromDate,
            estimatedCost: 0,
            actualCost: line.actualCost,
            isPlanned: false,
            note: line.note ?? null,
          }));
          diffLines.push(`Added unplanned cost "${saved.description}": $${line.actualCost.toFixed(2)}`);
          await this.attachmentsService.createAttachments(
            em, AttachmentOwnerType.TravelRequestItem, saved.id, userId, line.attachments,
          );
        }
      }

      const advanceAmount = travelRequest.approvedAdvanceAmount ?? travelRequest.advanceRequested;
      const netAdjustment = actualCost - Number(advanceAmount);

      await em.update(TravelRequest, { id: tripId }, {
        actualCost,
        netAdjustment,
        settlementStatus: TravelSettlementStatus.Pending,
        settlementLockedAt: null,
        settlementLockedBy: null,
      });

      const previousSettlementApproval = await this.approvalsService.getApprovalForEntity(
        ApprovalEntityType.TravelSettlement, tripId,
      );
      await restartApproval(this.approvalsService, {
        entityType: ApprovalEntityType.TravelSettlement,
        entityId: tripId,
        requesterId: userId,
        metricValue: actualCost,
        previousApprovalId: previousSettlementApproval?.id ?? null,
      });

      await this.changeLogService.record(
        em, ChangeEntityType.TravelRequest, tripId, userId,
        `Settlement submitted — ${diffLines.length ? diffLines.join('; ') : 'no changes to actual costs'} (net adjustment $${netAdjustment.toFixed(2)})`,
        { items: diffLines, netAdjustment },
      );

      return em.findOne(TravelRequest, { where: { id: tripId }, relations: ['items'] });
    });
  }

  async lockSettlement(tripId: string, actorId: string) {
    const travelRequest = await this.travelRepo.findOne({ where: { id: tripId } });
    if (!travelRequest) throw new NotFoundException('Travel request not found');
    if (travelRequest.settlementStatus !== TravelSettlementStatus.Approved) {
      throw new BadRequestException('Only an approved settlement can be locked');
    }
    await this.travelRepo.update({ id: tripId }, {
      settlementStatus: TravelSettlementStatus.Locked,
      settlementLockedAt: new Date(),
      settlementLockedBy: actorId,
    });
    return this.travelRepo.findOne({ where: { id: tripId } });
  }

  async getChangeLog(tripId: string) {
    return this.changeLogService.findForEntity(ChangeEntityType.TravelRequest, tripId);
  }

  async reimburseTravelRequest(id: string, dto: ReimburseTravelDto) {
    const travelRequest = await this.travelRepo.findOne({ where: { id } });
    if (!travelRequest) throw new NotFoundException('Travel request not found');
    if (travelRequest.timing !== TravelRequestTiming.PostTrip) {
      throw new BadRequestException('Only post-trip travel requests can be marked reimbursed');
    }
    if (travelRequest.status !== TravelRequestStatus.Approved) {
      throw new BadRequestException('Only an approved travel request can be marked reimbursed');
    }

    await this.travelRepo.update({ id }, {
      status: TravelRequestStatus.Reimbursed,
      reimbursedAt: new Date(),
      reimbursementRef: dto.reimbursementRef,
    });

    const employee = await this.employeeRepo.findOne({ where: { id: travelRequest.employeeId } });
    if (employee) {
      this.eventEmitter.emit('travel.reimbursed', {
        tripId: id,
        userId: employee.userId,
        reimbursementRef: dto.reimbursementRef,
      });
    }

    return this.travelRepo.findOne({ where: { id } });
  }

  async getReimbursableTravelRequests() {
    return this.travelRepo.find({
      where: { status: TravelRequestStatus.Approved, timing: TravelRequestTiming.PostTrip },
      relations: ['items', 'employee'],
      order: { updatedAt: 'ASC' },
    });
  }

  async cancelTravelRequest(id: string, userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const travelRequest = await this.travelRepo.findOne({ where: { id } });
    if (!travelRequest) throw new NotFoundException('Travel request not found');

    if (travelRequest.employeeId !== employee.id) {
      throw new ForbiddenException('You can only cancel your own travel requests');
    }

    if (![TravelRequestStatus.Draft, TravelRequestStatus.Pending].includes(travelRequest.status)) {
      throw new BadRequestException(`Cannot cancel a travel request with status "${travelRequest.status}"`);
    }

    await this.travelRepo.update({ id }, { status: TravelRequestStatus.Cancelled });

    if (travelRequest.approvalId) {
      await this.approvalsService.cancelApproval(travelRequest.approvalId).catch(() => undefined);
    }
  }

  async getMyTravelRequests(userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return this.travelRepo.find({
      where: { employeeId: employee.id },
      relations: ['items', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllTravelRequests(status?: string) {
    return this.travelRepo.find({
      where: status ? { status: status as TravelRequestStatus } : {},
      relations: ['items', 'employee', 'approval'],
      order: { createdAt: 'DESC' },
    });
  }

  async getApprovedTravelRequestsForUser(userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    return this.travelRepo.find({
      where: { employeeId: employee.id, status: TravelRequestStatus.Approved },
      relations: ['items'],
      order: { fromDate: 'DESC' },
    });
  }

  async getTravelRequestById(id: string, userId: string, canViewAll: boolean) {
    const travelRequest = await this.travelRepo.findOne({
      where: { id },
      relations: ['items', 'employee', 'approval', 'approval.workflow', 'approval.workflow.steps', 'approval.actions'],
    });
    if (!travelRequest) throw new NotFoundException('Travel request not found');

    if (!canViewAll) {
      const employee = await this.employeeRepo.findOne({ where: { userId } });
      if (!employee || travelRequest.employeeId !== employee.id) {
        throw new ForbiddenException('You do not have access to this travel request');
      }
    }

    const settlementApproval = travelRequest.settlementStatus !== TravelSettlementStatus.None
      ? await this.approvalsService.getApprovalForEntity(ApprovalEntityType.TravelSettlement, id)
      : null;

    return { ...travelRequest, settlementApproval };
  }

  // ── Approval event listeners ────────────────────────────────────────────────

  @OnEvent('approval.approved')
  async handleApprovalApproved(event: ApprovalFinalizedEvent) {
    if (event.entityType === ApprovalEntityType.TravelRequest) {
      const travelRequest = await this.travelRepo.findOne({ where: { id: event.entityId } });
      await this.travelRepo.update({ id: event.entityId }, {
        status: TravelRequestStatus.Approved,
        approvedAdvanceAmount: event.approvedAmount ?? travelRequest?.advanceRequested ?? 0,
      });
      return;
    }
    if (event.entityType === ApprovalEntityType.TravelSettlement) {
      await this.travelRepo.update({ id: event.entityId }, { settlementStatus: TravelSettlementStatus.Approved });
    }
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(event: ApprovalFinalizedEvent) {
    if (event.entityType === ApprovalEntityType.TravelRequest) {
      await this.travelRepo.update({ id: event.entityId }, { status: TravelRequestStatus.Rejected });
      return;
    }
    if (event.entityType === ApprovalEntityType.TravelSettlement) {
      await this.travelRepo.update({ id: event.entityId }, { settlementStatus: TravelSettlementStatus.Rejected });
    }
  }
}
