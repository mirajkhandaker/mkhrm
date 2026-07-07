import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AssetMovementType, AssetUnitStatus } from '@hrm/types';
import { AssetMaintenanceRecord } from '../../../database/entities/assets/asset-maintenance-record.entity';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { AssetMovement } from '../../../database/entities/assets/asset-movement.entity';
import { Employee } from '../../../database/entities/employees/employee.entity';
import { EndMaintenanceDto, StartMaintenanceDto } from '../dto/maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(AssetMaintenanceRecord) private repo: Repository<AssetMaintenanceRecord>,
    @InjectRepository(AssetUnit) private unitRepo: Repository<AssetUnit>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private dataSource: DataSource,
  ) {}

  listForUnit(unitId: string) {
    return this.repo.find({ where: { unitId }, order: { startedAt: 'DESC' } });
  }

  async start(userId: string, dto: StartMaintenanceDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');

    const unit = await this.unitRepo.findOne({ where: { id: dto.unitId } });
    if (!unit) throw new NotFoundException('Asset unit not found');
    if (unit.status === AssetUnitStatus.InMaintenance) {
      throw new BadRequestException('Unit is already in maintenance');
    }
    if (unit.status === AssetUnitStatus.Retired) {
      throw new BadRequestException('Cannot service a retired unit');
    }

    return this.dataSource.transaction(async (em) => {
      const record = await em.save(
        AssetMaintenanceRecord,
        em.create(AssetMaintenanceRecord, {
          unitId: unit.id,
          startedAt: new Date(),
          cost: dto.cost ?? 0,
          currency: dto.currency ?? 'USD',
          vendor: dto.vendor ?? null,
          description: dto.description,
          outcome: null,
          createdBy: employee.id,
        }),
      );
      await em.update(AssetUnit, { id: unit.id }, { status: AssetUnitStatus.InMaintenance });
      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: unit.id,
          categoryId: unit.categoryId,
          movementType: AssetMovementType.MaintenanceIn,
          fromHolderType: unit.currentHolderType,
          fromHolderId: unit.currentEmployeeId ?? unit.currentDepartmentId ?? unit.currentLocationId,
          quantity: 1,
          reference: `maintenance:${record.id}`,
          performedBy: employee.id,
        }),
      );
      return record;
    });
  }

  async end(id: string, userId: string, dto: EndMaintenanceDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');

    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Maintenance record not found');
    if (record.endedAt) throw new BadRequestException('Maintenance is already closed');

    const unit = await this.unitRepo.findOne({ where: { id: record.unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    return this.dataSource.transaction(async (em) => {
      record.endedAt = new Date();
      record.outcome = dto.outcome;
      if (dto.cost != null) record.cost = dto.cost;
      await em.save(AssetMaintenanceRecord, record);

      const nextStatus = dto.outcome === 'written_off' ? AssetUnitStatus.Retired : AssetUnitStatus.InStock;
      await em.update(AssetUnit, { id: unit.id }, { status: nextStatus });

      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: unit.id,
          categoryId: unit.categoryId,
          movementType: AssetMovementType.MaintenanceOut,
          toHolderType: unit.currentHolderType,
          toHolderId: unit.currentEmployeeId ?? unit.currentDepartmentId ?? unit.currentLocationId,
          quantity: 1,
          reference: `maintenance:${record.id}`,
          note: dto.note ?? null,
          performedBy: employee.id,
        }),
      );
      return record;
    });
  }
}
