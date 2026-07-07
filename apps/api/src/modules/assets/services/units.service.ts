import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ApprovalEntityType,
  AssetHolderType,
  AssetMovementType,
  AssetUnitStatus,
} from '@hrm/types';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { AssetMovement } from '../../../database/entities/assets/asset-movement.entity';
import { AssetLocation } from '../../../database/entities/assets/asset-location.entity';
import { Employee } from '../../../database/entities/employees/employee.entity';
import { Department } from '../../../database/entities/employees/department.entity';
import { ApprovalsService } from '../../approvals/approvals.service';
import { AssignUnitDto, ReturnUnitDto, TransferUnitDto, UpdateUnitDto } from '../dto/unit.dto';
import { restartApproval } from '../../../common/utils/restart-approval.util';

export interface HolderRef {
  type: AssetHolderType;
  id: string;
}

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(AssetUnit) private unitRepo: Repository<AssetUnit>,
    @InjectRepository(AssetMovement) private movementRepo: Repository<AssetMovement>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(Department) private departmentRepo: Repository<Department>,
    @InjectRepository(AssetLocation) private locationRepo: Repository<AssetLocation>,
    private dataSource: DataSource,
    private approvalsService: ApprovalsService,
  ) {}

  // ── List / read ─────────────────────────────────────────────────────────────

  list(filters: {
    categoryId?: string;
    status?: AssetUnitStatus;
    locationId?: string;
    holderEmployeeId?: string;
  } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;
    if (filters.locationId) where.currentLocationId = filters.locationId;
    if (filters.holderEmployeeId) where.currentEmployeeId = filters.holderEmployeeId;

    return this.unitRepo.find({
      where,
      relations: [
        'category',
        'condition',
        'currentEmployee',
        'currentDepartment',
        'currentLocation',
      ],
      order: { assetTag: 'ASC' },
    });
  }

  async findOne(id: string) {
    const unit = await this.unitRepo.findOne({
      where: { id },
      relations: [
        'category',
        'condition',
        'currentEmployee',
        'currentDepartment',
        'currentLocation',
      ],
    });
    if (!unit) throw new NotFoundException('Asset unit not found');
    return unit;
  }

  async movementHistory(unitId: string) {
    await this.findOne(unitId);
    return this.movementRepo.find({
      where: { unitId },
      relations: ['performer'],
      order: { performedAt: 'DESC' },
    });
  }

  async listMine(userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) return [];
    return this.list({ holderEmployeeId: employee.id });
  }

  async update(id: string, dto: UpdateUnitDto) {
    const unit = await this.findOne(id);
    Object.assign(unit, dto);
    return this.unitRepo.save(unit);
  }

  // ── Approval-gated assign ───────────────────────────────────────────────────

  /**
   * Start (or restart) an AssetAssignment approval targeting `holder`.
   * The holder change is only committed when the approval resolves (see
   * AssetsEventsListener). Meanwhile the unit stays where it was.
   */
  async requestAssign(id: string, userId: string, dto: AssignUnitDto) {
    const unit = await this.findOne(id);
    if (unit.status === AssetUnitStatus.Retired) {
      throw new BadRequestException('Cannot assign a retired unit');
    }
    if (unit.status === AssetUnitStatus.InMaintenance) {
      throw new BadRequestException('Cannot assign a unit that is in maintenance');
    }
    await this.assertHolderExists({ type: dto.type, id: dto.id });

    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');

    // Save the "requested" marker BEFORE starting the approval. This matters
    // because the engine emits `approval.approved` synchronously if every step
    // is skipped (e.g. no line manager, metric_value below all thresholds) —
    // if we start() first, the listener runs before the marker exists and the
    // commit is silently lost. So: marker first with placeholder ref, then
    // start, then rewrite the ref with the real approvalId. If the approval
    // came back already-approved, commit inline.
    const marker = await this.movementRepo.save(
      this.movementRepo.create({
        unitId: unit.id,
        categoryId: unit.categoryId,
        movementType: AssetMovementType.Assign,
        fromHolderType: unit.currentHolderType,
        fromHolderId: this.currentHolderId(unit),
        toHolderType: dto.type,
        toHolderId: dto.id,
        quantity: 1,
        reference: `pending:${unit.id}`,
        note: dto.note ?? 'requested',
        performedBy: employee.id,
      }),
    );

    const approval = await restartApproval(this.approvalsService, {
      entityType: ApprovalEntityType.AssetAssignment,
      entityId: id,
      requesterId: userId,
      metricValue: Number(unit.purchaseCost) || 0,
      previousApprovalId: null,
    });

    await this.movementRepo.update({ id: marker.id }, { reference: `approval:${approval.id}` });

    if (approval.status === 'approved') {
      // The engine auto-approved (every step skipped). Commit synchronously —
      // the listener ran before we updated the marker reference, so it did nothing.
      await this.commitAssignmentFromApproval(unit.id, approval.id, employee.id);
    }

    return { approvalId: approval.id, status: 'requested' as const };
  }

  /**
   * Called by the AssetsEventsListener after an AssetAssignment approval is
   * approved. Commits the holder change and appends a movement row with note
   * "committed" so the audit trail is a matched pair (requested → committed).
   */
  async commitAssignmentFromApproval(unitId: string, approvalId: string, performedByEmployeeId: string) {
    const unit = await this.findOne(unitId);
    const marker = await this.movementRepo.findOne({
      where: { reference: `approval:${approvalId}`, movementType: AssetMovementType.Assign },
      order: { performedAt: 'DESC' },
    });
    if (!marker || !marker.toHolderType || !marker.toHolderId) {
      // Approval finalized but we never recorded the target — nothing to commit.
      return;
    }
    await this.dataSource.transaction(async (em) => {
      const upd = em.create(AssetUnit, {
        currentHolderType: marker.toHolderType!,
        currentEmployeeId: null,
        currentDepartmentId: null,
        currentLocationId: null,
        currentHolderSince: new Date().toISOString().slice(0, 10),
        status: AssetUnitStatus.Assigned,
      });
      this.setHolderColumn(upd, marker.toHolderType!, marker.toHolderId!);

      await em.update(AssetUnit, { id: unit.id }, {
        currentHolderType: upd.currentHolderType,
        currentEmployeeId: upd.currentEmployeeId,
        currentDepartmentId: upd.currentDepartmentId,
        currentLocationId: upd.currentLocationId,
        currentHolderSince: upd.currentHolderSince,
        status: AssetUnitStatus.Assigned,
      });
      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: unit.id,
          categoryId: unit.categoryId,
          movementType: AssetMovementType.Assign,
          fromHolderType: unit.currentHolderType,
          fromHolderId: this.currentHolderId(unit),
          toHolderType: marker.toHolderType!,
          toHolderId: marker.toHolderId!,
          quantity: 1,
          reference: `approval:${approvalId}`,
          note: 'committed',
          performedBy: performedByEmployeeId,
        }),
      );
    });
  }

  // ── Return / Transfer / Retire ─────────────────────────────────────────────

  async returnToStock(id: string, userId: string, dto: ReturnUnitDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');
    const unit = await this.findOne(id);

    if (!(await this.locationRepo.findOne({ where: { id: dto.toLocationId } }))) {
      throw new NotFoundException('Return location not found');
    }

    const from = { type: unit.currentHolderType, id: this.currentHolderId(unit)! };
    await this.dataSource.transaction(async (em) => {
      await em.update(AssetUnit, { id }, {
        currentHolderType: AssetHolderType.Location,
        currentEmployeeId: null,
        currentDepartmentId: null,
        currentLocationId: dto.toLocationId,
        currentHolderSince: new Date().toISOString().slice(0, 10),
        status: AssetUnitStatus.InStock,
      });
      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: id,
          categoryId: unit.categoryId,
          movementType: AssetMovementType.Return,
          fromHolderType: from.type,
          fromHolderId: from.id,
          toHolderType: AssetHolderType.Location,
          toHolderId: dto.toLocationId,
          quantity: 1,
          note: dto.note ?? null,
          performedBy: employee.id,
        }),
      );
    });
    return this.findOne(id);
  }

  async transfer(id: string, userId: string, dto: TransferUnitDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');
    const unit = await this.findOne(id);
    if (unit.status === AssetUnitStatus.Retired) {
      throw new BadRequestException('Cannot transfer a retired unit');
    }
    await this.assertHolderExists({ type: dto.type, id: dto.id });

    const from = { type: unit.currentHolderType, id: this.currentHolderId(unit)! };
    await this.dataSource.transaction(async (em) => {
      const columns: Pick<AssetUnit, 'currentEmployeeId' | 'currentDepartmentId' | 'currentLocationId'> & { currentHolderType?: AssetHolderType } = {
        currentEmployeeId: null, currentDepartmentId: null, currentLocationId: null,
      };
      this.setHolderColumn(columns as AssetUnit, dto.type, dto.id);
      await em.update(AssetUnit, { id }, {
        currentHolderType: dto.type,
        currentEmployeeId: columns.currentEmployeeId,
        currentDepartmentId: columns.currentDepartmentId,
        currentLocationId: columns.currentLocationId,
        currentHolderSince: new Date().toISOString().slice(0, 10),
        status: dto.type === AssetHolderType.Location ? AssetUnitStatus.InStock : AssetUnitStatus.Assigned,
      });
      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: id,
          categoryId: unit.categoryId,
          movementType: AssetMovementType.Transfer,
          fromHolderType: from.type,
          fromHolderId: from.id,
          toHolderType: dto.type,
          toHolderId: dto.id,
          quantity: 1,
          note: dto.note ?? null,
          performedBy: employee.id,
        }),
      );
    });
    return this.findOne(id);
  }

  async retire(id: string, userId: string, reason?: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');
    const unit = await this.findOne(id);
    if (unit.status === AssetUnitStatus.Retired) {
      throw new BadRequestException('Unit is already retired');
    }

    // Retiring keeps the CHECK constraint happy by parking the unit at a
    // "retirement location" — its current location. Callers must supply one
    // if the unit doesn't currently have one (impossible today, but explicit).
    const locationId = unit.currentLocationId ?? null;
    if (!locationId) {
      throw new BadRequestException('Return the unit to a location before retiring');
    }

    const from = { type: unit.currentHolderType, id: this.currentHolderId(unit)! };
    await this.dataSource.transaction(async (em) => {
      await em.update(AssetUnit, { id }, {
        currentHolderType: AssetHolderType.Location,
        currentEmployeeId: null,
        currentDepartmentId: null,
        currentLocationId: locationId!,
        currentHolderSince: new Date().toISOString().slice(0, 10),
        status: AssetUnitStatus.Retired,
      });
      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: id,
          categoryId: unit.categoryId,
          movementType: AssetMovementType.Retire,
          fromHolderType: from.type,
          fromHolderId: from.id,
          toHolderType: AssetHolderType.Location,
          toHolderId: locationId!,
          quantity: 1,
          note: reason ?? null,
          performedBy: employee.id,
        }),
      );
    });
    return this.findOne(id);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private currentHolderId(unit: AssetUnit): string | null {
    switch (unit.currentHolderType) {
      case AssetHolderType.Employee: return unit.currentEmployeeId;
      case AssetHolderType.Department: return unit.currentDepartmentId;
      case AssetHolderType.Location: return unit.currentLocationId;
    }
  }

  private setHolderColumn(target: AssetUnit, type: AssetHolderType, id: string) {
    target.currentEmployeeId = null;
    target.currentDepartmentId = null;
    target.currentLocationId = null;
    if (type === AssetHolderType.Employee) target.currentEmployeeId = id;
    else if (type === AssetHolderType.Department) target.currentDepartmentId = id;
    else target.currentLocationId = id;
  }

  private async assertHolderExists(h: HolderRef) {
    let ok = false;
    if (h.type === AssetHolderType.Employee) {
      ok = !!(await this.employeeRepo.findOne({ where: { id: h.id } }));
    } else if (h.type === AssetHolderType.Department) {
      ok = !!(await this.departmentRepo.findOne({ where: { id: h.id } }));
    } else {
      ok = !!(await this.locationRepo.findOne({ where: { id: h.id } }));
    }
    if (!ok) throw new NotFoundException(`Target ${h.type} not found`);
  }
}
