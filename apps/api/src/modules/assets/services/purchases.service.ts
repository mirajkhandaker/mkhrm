import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssetHolderType,
  AssetMovementType,
  AssetPurchaseStatus,
  AssetTrackingMode,
  AssetUnitStatus,
} from '@hrm/types';
import { AssetPurchase } from '../../../database/entities/assets/asset-purchase.entity';
import { AssetPurchaseItem } from '../../../database/entities/assets/asset-purchase-item.entity';
import { AssetCategory } from '../../../database/entities/assets/asset-category.entity';
import { AssetCondition } from '../../../database/entities/assets/asset-condition.entity';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { AssetStock } from '../../../database/entities/assets/asset-stock.entity';
import { AssetMovement } from '../../../database/entities/assets/asset-movement.entity';
import { Employee } from '../../../database/entities/employees/employee.entity';
import { Requisition } from '../../../database/entities/requisitions/requisition.entity';
import { SettingsService } from '../../settings/settings.service';
import { CreateAssetPurchaseDto } from '../dto/purchase.dto';

export interface AssetStockLowEvent {
  categoryId: string;
  locationId: string;
  quantity: number;
  minQuantity: number;
}

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(AssetPurchase) private purchaseRepo: Repository<AssetPurchase>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(Requisition) private requisitionRepo: Repository<Requisition>,
    private dataSource: DataSource,
    private settingsService: SettingsService,
    private eventEmitter: EventEmitter2,
  ) {}

  list(status?: AssetPurchaseStatus) {
    return this.purchaseRepo.find({
      where: status ? { status } : {},
      relations: ['items', 'linkedRequisition', 'receiver'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const p = await this.purchaseRepo.findOne({
      where: { id },
      relations: ['items', 'items.category', 'items.location', 'linkedRequisition', 'receiver'],
    });
    if (!p) throw new NotFoundException('Purchase not found');
    return p;
  }

  async create(userId: string, dto: CreateAssetPurchaseDto) {
    const total = dto.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

    // Guard: walk-in purchases (no linked requisition) above threshold are blocked.
    if (!dto.linkedRequisitionId) {
      const threshold = await this.settingsService.getValue<number>(
        'asset_purchase_threshold_without_requisition',
        1000,
      );
      if (total > threshold) {
        throw new BadRequestException(
          `Walk-in purchase total (${total}) exceeds threshold (${threshold}). ` +
            `Create an asset requisition first and link it, or ask an admin to raise the threshold.`,
        );
      }
    } else {
      // Confirm the requisition exists (referential sanity beyond FK for a nicer error)
      if (!(await this.requisitionRepo.findOne({ where: { id: dto.linkedRequisitionId } }))) {
        throw new NotFoundException('Linked requisition not found');
      }
    }

    return this.dataSource.transaction(async (em) => {
      const purchase = await em.save(
        AssetPurchase,
        em.create(AssetPurchase, {
          vendor: dto.vendor,
          invoiceNo: dto.invoiceNo ?? null,
          invoiceDate: dto.invoiceDate,
          totalAmount: total,
          currency: dto.currency ?? 'USD',
          linkedRequisitionId: dto.linkedRequisitionId ?? null,
          notes: dto.notes ?? null,
          status: AssetPurchaseStatus.Draft,
        }),
      );
      await em.save(
        AssetPurchaseItem,
        dto.items.map((i) =>
          em.create(AssetPurchaseItem, {
            purchaseId: purchase.id,
            categoryId: i.categoryId,
            quantity: i.quantity,
            unitCost: i.unitCost,
            warrantyMonths: i.warrantyMonths ?? null,
            locationId: i.locationId,
            note: i.note ?? null,
          }),
        ),
      );
      return purchase;
    });
  }

  async cancel(id: string) {
    const purchase = await this.findOne(id);
    if (purchase.status !== AssetPurchaseStatus.Draft) {
      throw new BadRequestException('Only draft purchases can be cancelled');
    }
    await this.purchaseRepo.update({ id }, { status: AssetPurchaseStatus.Cancelled });
  }

  /**
   * Turn a draft purchase into physical inventory in one atomic step.
   * Serialized categories → N asset_units per line, tags auto-generated.
   * Consumable categories → bump asset_stock row for the (category, location).
   * A movement row is appended for every line.
   */
  async receive(id: string, userId: string) {
    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');

    const purchase = await this.findOne(id);
    if (purchase.status !== AssetPurchaseStatus.Draft) {
      throw new BadRequestException(`Purchase is already ${purchase.status}`);
    }

    // Read settings inside the txn to keep the tag counter consistent.
    const tagPrefix = await this.settingsService.getValue<string>('asset_tag_prefix', 'HRM-');

    const lowStockEvents: AssetStockLowEvent[] = [];

    await this.dataSource.transaction(async (em) => {
      let nextTag = await this.settingsService.getValue<number>('asset_tag_next_number', 1);

      // Load a default "in_stock" condition to attach to freshly-created units.
      const conditionRepo = em.getRepository(AssetCondition);
      const defaultCondition =
        (await conditionRepo.findOne({ where: { isActive: true }, order: { displayOrder: 'ASC' } })) ??
        null;
      if (!defaultCondition) {
        throw new BadRequestException(
          'No active asset condition configured — seed at least one (e.g. "New") before receiving purchases.',
        );
      }

      for (const item of purchase.items) {
        const category = await em.getRepository(AssetCategory).findOne({ where: { id: item.categoryId } });
        if (!category) throw new NotFoundException('Category on purchase item not found');

        if (category.trackingMode === AssetTrackingMode.Serialized) {
          for (let i = 0; i < item.quantity; i++) {
            const tag = `${tagPrefix}${String(nextTag).padStart(6, '0')}`;
            nextTag += 1;

            const warrantyMonths = item.warrantyMonths ?? category.defaultWarrantyMonths ?? null;
            const warrantyUntil = warrantyMonths != null
              ? this.addMonthsIsoDate(purchase.invoiceDate, warrantyMonths)
              : null;

            const unit = await em.save(
              AssetUnit,
              em.create(AssetUnit, {
                categoryId: category.id,
                assetTag: tag,
                name: category.name,
                purchaseCost: item.unitCost,
                purchasedOn: purchase.invoiceDate,
                warrantyUntil,
                conditionId: defaultCondition.id,
                status: AssetUnitStatus.InStock,
                currentHolderType: AssetHolderType.Location,
                currentLocationId: item.locationId,
                currentEmployeeId: null,
                currentDepartmentId: null,
                currentHolderSince: purchase.invoiceDate,
              }),
            );

            await em.save(
              AssetMovement,
              em.create(AssetMovement, {
                unitId: unit.id,
                categoryId: category.id,
                movementType: AssetMovementType.StockIn,
                toHolderType: AssetHolderType.Location,
                toHolderId: item.locationId,
                quantity: 1,
                reference: `purchase:${purchase.id}`,
                performedBy: employee.id,
              }),
            );
          }
        } else {
          // Consumable — upsert the stock row and bump quantity.
          const stockRepo = em.getRepository(AssetStock);
          let stock = await stockRepo.findOne({
            where: { categoryId: category.id, locationId: item.locationId },
          });
          if (!stock) {
            stock = await stockRepo.save(
              stockRepo.create({
                categoryId: category.id,
                locationId: item.locationId,
                quantity: 0,
              }),
            );
          }
          const before = stock.quantity;
          stock.quantity = before + item.quantity;
          await stockRepo.save(stock);

          await em.save(
            AssetMovement,
            em.create(AssetMovement, {
              unitId: null,
              categoryId: category.id,
              movementType: AssetMovementType.StockIn,
              toHolderType: AssetHolderType.Location,
              toHolderId: item.locationId,
              quantity: item.quantity,
              reference: `purchase:${purchase.id}`,
              performedBy: employee.id,
            }),
          );

          // Receiving strictly raises stock, so it can never trip low-stock — no event here.
        }
      }

      // Persist the tag counter after all serialized items were created.
      await this.settingsService.upsert('asset_tag_next_number', nextTag);

      await em.update(
        AssetPurchase,
        { id: purchase.id },
        {
          status: AssetPurchaseStatus.Received,
          receivedAt: new Date(),
          receivedBy: employee.id,
        },
      );
    });

    for (const evt of lowStockEvents) this.eventEmitter.emit('asset.stock.low', evt);
    return this.findOne(id);
  }

  private addMonthsIsoDate(dateIso: string, months: number): string {
    const d = new Date(dateIso);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }
}
