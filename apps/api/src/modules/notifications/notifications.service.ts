import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { ApprovalEntityType, NotificationType } from '@hrm/types';
import { Notification } from '../../database/entities/system/notification.entity';
import { User } from '../../database/entities/auth/user.entity';
import {
  ApprovalPendingEvent,
  ApprovalFinalizedEvent,
  ApprovalReturnedEvent,
} from '../approvals/approvals.service';

interface ExpenseReimbursedEvent {
  claimId: string;
  userId: string;
  reimbursementRef: string;
}

interface TravelReimbursedEvent {
  tripId: string;
  userId: string;
  reimbursementRef: string;
}

const ENTITY_LABEL: Record<ApprovalEntityType, string> = {
  [ApprovalEntityType.Leave]: 'leave request',
  [ApprovalEntityType.Requisition]: 'requisition',
  [ApprovalEntityType.TravelRequest]: 'travel request',
  [ApprovalEntityType.TravelSettlement]: 'travel settlement',
  [ApprovalEntityType.ExpenseClaim]: 'expense claim',
  [ApprovalEntityType.Regularization]: 'attendance regularization',
  [ApprovalEntityType.AssetAssignment]: 'asset assignment',
};

const ENTITY_LINK: Record<ApprovalEntityType, (id: string) => string> = {
  [ApprovalEntityType.Leave]: () => '/leave',
  [ApprovalEntityType.Requisition]: (id) => `/requisitions/${id}`,
  [ApprovalEntityType.TravelRequest]: (id) => `/travel/${id}`,
  [ApprovalEntityType.TravelSettlement]: (id) => `/travel/${id}`,
  [ApprovalEntityType.ExpenseClaim]: (id) => `/expenses/${id}`,
  [ApprovalEntityType.Regularization]: () => '/attendance',
  [ApprovalEntityType.AssetAssignment]: (id) => `/assets/${id}`,
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async notify(userId: string, type: NotificationType, title: string, body: string, link: string | null = null) {
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({ userId, type, title, body, link }),
    );
    await this.sendEmailStub(userId, title, body);
    return notification;
  }

  findMine(userId: string) {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  getUnreadCount(userId: string) {
    return this.notificationRepo.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.notificationRepo.findOne({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only mark your own notifications as read');
    }
    await this.notificationRepo.update({ id }, { isRead: true });
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
  }

  // ── Email stub ──────────────────────────────────────────────────────────────
  // Real delivery is out of scope for this build — logs what would have been sent.

  private async sendEmailStub(userId: string, subject: string, body: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    console.log(`[email stub] To: ${user.email} | Subject: ${subject} | ${body}`);
  }

  // ── Approval engine event listeners ─────────────────────────────────────────

  @OnEvent('approval.pending')
  async handleApprovalPending(event: ApprovalPendingEvent) {
    const label = ENTITY_LABEL[event.entityType] ?? 'request';
    await Promise.all(
      event.approverIds.map((approverId) =>
        this.notify(
          approverId,
          NotificationType.ApprovalRequested,
          `New ${label} awaiting your approval`,
          `A ${label} has been routed to you for review.`,
          '/approvals',
        ),
      ),
    );
  }

  @OnEvent('approval.approved')
  async handleApprovalApproved(event: ApprovalFinalizedEvent) {
    const label = ENTITY_LABEL[event.entityType] ?? 'request';
    const link = (ENTITY_LINK[event.entityType] ?? (() => '/approvals'))(event.entityId);
    await this.notify(
      event.requestedBy,
      NotificationType.ApprovalApproved,
      `Your ${label} was approved`,
      `Your ${label} has been approved.`,
      link,
    );
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(event: ApprovalFinalizedEvent) {
    const label = ENTITY_LABEL[event.entityType] ?? 'request';
    const link = (ENTITY_LINK[event.entityType] ?? (() => '/approvals'))(event.entityId);
    await this.notify(
      event.requestedBy,
      NotificationType.ApprovalRejected,
      `Your ${label} was rejected`,
      `Your ${label} was rejected.`,
      link,
    );
  }

  @OnEvent('approval.returned')
  async handleApprovalReturned(event: ApprovalReturnedEvent) {
    const label = ENTITY_LABEL[event.entityType] ?? 'request';
    const link = (ENTITY_LINK[event.entityType] ?? (() => '/approvals'))(event.entityId);
    await this.notify(
      event.requestedBy,
      NotificationType.System,
      `Your ${label} needs changes`,
      `Your ${label} was returned by an approver — please review and resubmit.`,
      link,
    );
  }

  @OnEvent('expense.reimbursed')
  async handleExpenseReimbursed(event: ExpenseReimbursedEvent) {
    await this.notify(
      event.userId,
      NotificationType.ExpenseReimbursed,
      'Expense claim reimbursed',
      `Your expense claim has been reimbursed (ref ${event.reimbursementRef}).`,
      `/expenses/${event.claimId}`,
    );
  }

  @OnEvent('travel.reimbursed')
  async handleTravelReimbursed(event: TravelReimbursedEvent) {
    await this.notify(
      event.userId,
      NotificationType.TravelReimbursed,
      'Travel request reimbursed',
      `Your travel request has been reimbursed (ref ${event.reimbursementRef}).`,
      `/travel/${event.tripId}`,
    );
  }
}
