import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { ApprovalEntityType } from '@hrm/types';
import { Employee } from '../../../database/entities/employees/employee.entity';
import { ApprovalFinalizedEvent } from '../../approvals/approvals.service';
import { UnitsService } from './units.service';

@Injectable()
export class AssetsEventsListener {
  constructor(
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private unitsService: UnitsService,
  ) {}

  @OnEvent('approval.approved')
  async onApprovalApproved(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.AssetAssignment) return;
    const employee = await this.employeeRepo.findOne({ where: { userId: event.requestedBy } });
    if (!employee) return;
    await this.unitsService.commitAssignmentFromApproval(
      event.entityId,
      event.approvalId,
      employee.id,
    );
  }

  @OnEvent('approval.rejected')
  async onApprovalRejected(event: ApprovalFinalizedEvent) {
    if (event.entityType !== ApprovalEntityType.AssetAssignment) return;
    // Nothing to undo — the target was never applied to current_* columns.
    // The "requested" movement row stays as an audit record.
  }
}
