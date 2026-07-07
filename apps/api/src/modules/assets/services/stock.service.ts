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
