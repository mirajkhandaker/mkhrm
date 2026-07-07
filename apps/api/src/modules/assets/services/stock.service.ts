import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssetHolderType, AssetMovementType, AssetTrackingMode } from '@hrm/types';
import { AssetStock } from '../../../database/entities/assets/asset-stock.entity';
import { AssetCategory } from '../../../database/entities/assets/asset-category.entity';
import { AssetMovement } from '../../../database/entities/assets/asset-movement.entity';
import { Employee } from '../../../database/entities/employees/employee.entity';
import { SettingsService } from '../../settings/settings.service';
import { IssueConsumableDto, SetMinQuantityDto, StockAdjustDto } from '../dto/stock.dto';
import { AssetStockLowEvent } from './purchases.service';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(AssetStock) private stockRepo: Repository<AssetStock>,
    @InjectRepository(AssetCategory) private categoryRepo: Repository<AssetCategory>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private dataSource: DataSource,
    private settingsService: SettingsService,
    private eventEmitter: EventEmitter2,
  ) {}

  list(filters: { categoryId?: string; locationId?: string } = {}) {
    return this.stockRepo.find({
      where: filters,
      relations: ['category', 'location'],
      order: { updatedAt: 'DESC' },
    });
  }

  // Consumable-issuance ledger: who received what, how many, and where from.
  // Joined via a raw query because to_holder_id is polymorphic (no FK) —
  // dispatching by to_holder_type keeps a single result row per movement.
  async listIssued(filters: { categoryId?: string; locationId?: string; toEmployeeId?: string } = {}) {
    const params: (string | undefined)[] = [];
    const where: string[] = [`m.movement_type = 'issue_consumable'`];
    if (filters.categoryId)   { params.push(filters.categoryId);   where.push(`m.category_id = $${params.length}`); }
    if (filters.locationId)   { params.push(filters.locationId);   where.push(`m.from_holder_id = $${params.length}`); }
    if (filters.toEmployeeId) { params.push(filters.toEmployeeId); where.push(`(m.to_holder_type = 'employee' AND m.to_holder_id = $${params.length})`); }

    const rows: Array<{
      id: string;
      performed_at: Date;
      quantity: number;
      note: string | null;
      category_id: string;
      category_name: string;
      from_location_id: string | null;
      from_location_name: string | null;
      to_holder_type: string;
      to_holder_id: string;
      to_employee_first: string | null;
      to_employee_last: string | null;
      to_department_name: string | null;
      to_location_name: string | null;
      performer_first: string | null;
      performer_last: string | null;
    }> = await this.dataSource.query(
      `SELECT
         m.id, m.performed_at, m.quantity, m.note,
         m.category_id, cat.name AS category_name,
         m.from_holder_id AS from_location_id, floc.name AS from_location_name,
         m.to_holder_type, m.to_holder_id,
         emp.first_name AS to_employee_first, emp.last_name AS to_employee_last,
         dep.name AS to_department_name,
         tloc.name AS to_location_name,
         perf.first_name AS performer_first, perf.last_name AS performer_last
       FROM asset_movements m
       LEFT JOIN asset_categories cat ON cat.id = m.category_id
       LEFT JOIN asset_locations  floc ON floc.id = m.from_holder_id AND m.from_holder_type = 'location'
       LEFT JOIN employees emp ON emp.id = m.to_holder_id AND m.to_holder_type = 'employee'
       LEFT JOIN departments dep ON dep.id = m.to_holder_id AND m.to_holder_type = 'department'
       LEFT JOIN asset_locations tloc ON tloc.id = m.to_holder_id AND m.to_holder_type = 'location'
       LEFT JOIN employees perf ON perf.id = m.performed_by
       WHERE ${where.join(' AND ')}
       ORDER BY m.performed_at DESC
       LIMIT 500`,
      params,
    );

    return rows.map((r) => ({
      id: r.id,
      performedAt: r.performed_at,
      quantity: r.quantity,
      note: r.note,
      category: { id: r.category_id, name: r.category_name },
      fromLocation: r.from_location_id ? { id: r.from_location_id, name: r.from_location_name } : null,
      toHolderType: r.to_holder_type,
      toHolderId: r.to_holder_id,
      toEmployee:   r.to_holder_type === 'employee'   ? { firstName: r.to_employee_first ?? '', lastName: r.to_employee_last ?? '' } : null,
      toDepartment: r.to_holder_type === 'department' ? { name: r.to_department_name ?? '' } : null,
      toLocation:   r.to_holder_type === 'location'   ? { name: r.to_location_name ?? '' } : null,
      performer: r.performer_first ? { firstName: r.performer_first, lastName: r.performer_last ?? '' } : null,
    }));
  }

  async setMinQuantity(id: string, dto: SetMinQuantityDto) {
    const row = await this.stockRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Stock row not found');
    row.minQuantity = dto.minQuantity ?? null;
    return this.stockRepo.save(row);
  }

  async adjust(userId: string, dto: StockAdjustDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');

    const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    if (category.trackingMode !== AssetTrackingMode.Consumable) {
      throw new BadRequestException('Stock adjustments apply to consumable categories only');
    }

    let low: AssetStockLowEvent | null = null;
    await this.dataSource.transaction(async (em) => {
      const stockRepo = em.getRepository(AssetStock);
      let stock = await stockRepo.findOne({
        where: { categoryId: dto.categoryId, locationId: dto.locationId },
      });
      if (!stock) {
        if (dto.delta < 0) {
          throw new BadRequestException('Cannot subtract from an empty stock row');
        }
        stock = await stockRepo.save(
          stockRepo.create({ categoryId: dto.categoryId, locationId: dto.locationId, quantity: 0 }),
        );
      }
      const next = stock.quantity + dto.delta;
      if (next < 0) throw new BadRequestException('Stock cannot go negative');
      stock.quantity = next;
      await stockRepo.save(stock);

      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: null,
          categoryId: dto.categoryId,
          movementType: AssetMovementType.StockIn,
          toHolderType: AssetHolderType.Location,
          toHolderId: dto.locationId,
          quantity: Math.abs(dto.delta),
          note: dto.note ?? null,
          performedBy: employee.id,
        }),
      );

      const min = stock.minQuantity
        ?? (await this.settingsService.getValue<number>('consumable_low_stock_threshold_default', 10));
      if (next <= min && dto.delta < 0) {
        low = { categoryId: stock.categoryId, locationId: stock.locationId, quantity: next, minQuantity: min };
      }
    });

    if (low) this.eventEmitter.emit('asset.stock.low', low);
    return this.stockRepo.findOne({
      where: { categoryId: dto.categoryId, locationId: dto.locationId },
      relations: ['category', 'location'],
    });
  }

  async issueConsumable(userId: string, dto: IssueConsumableDto) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');

    const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    if (category.trackingMode !== AssetTrackingMode.Consumable) {
      throw new BadRequestException('Only consumable categories can be issued from stock');
    }

    let low: AssetStockLowEvent | null = null;
    await this.dataSource.transaction(async (em) => {
      const stockRepo = em.getRepository(AssetStock);
      const stock = await stockRepo.findOne({
        where: { categoryId: dto.categoryId, locationId: dto.locationId },
      });
      if (!stock) throw new NotFoundException('No stock at that location for this category');
      if (stock.quantity < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock (${stock.quantity} available, ${dto.quantity} requested)`,
        );
      }
      stock.quantity -= dto.quantity;
      await stockRepo.save(stock);

      await em.save(
        AssetMovement,
        em.create(AssetMovement, {
          unitId: null,
          categoryId: dto.categoryId,
          movementType: AssetMovementType.IssueConsumable,
          fromHolderType: AssetHolderType.Location,
          fromHolderId: dto.locationId,
          toHolderType: dto.toHolderType,
          toHolderId: dto.toHolderId,
          quantity: dto.quantity,
          note: dto.note ?? null,
          performedBy: employee.id,
        }),
      );

      const min = stock.minQuantity
        ?? (await this.settingsService.getValue<number>('consumable_low_stock_threshold_default', 10));
      if (stock.quantity <= min) {
        low = {
          categoryId: stock.categoryId,
          locationId: stock.locationId,
          quantity: stock.quantity,
          minQuantity: min,
        };
      }
    });

    if (low) this.eventEmitter.emit('asset.stock.low', low);
  }
}
