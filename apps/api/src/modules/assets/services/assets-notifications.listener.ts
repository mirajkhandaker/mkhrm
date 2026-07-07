import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType, Permission as P } from '@hrm/types';
import { NotificationsService } from '../../notifications/notifications.service';
import { AssetCategory } from '../../../database/entities/assets/asset-category.entity';
import { AssetLocation } from '../../../database/entities/assets/asset-location.entity';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { AssetStockLowEvent } from './purchases.service';

@Injectable()
export class AssetsNotificationsListener {
  constructor(
    private notifications: NotificationsService,
    @InjectRepository(AssetCategory) private categoryRepo: Repository<AssetCategory>,
    @InjectRepository(AssetLocation) private locationRepo: Repository<AssetLocation>,
    @InjectRepository(AssetUnit) private unitRepo: Repository<AssetUnit>,
    private dataSource: DataSource,
  ) {}

  // ── Low-stock notification ──────────────────────────────────────────────────

  @OnEvent('asset.stock.low')
  async onStockLow(event: AssetStockLowEvent) {
    const category = await this.categoryRepo.findOne({ where: { id: event.categoryId } });
    const location = await this.locationRepo.findOne({ where: { id: event.locationId } });
    if (!category || !location) return;
    const recipients = await this.usersWithPermission(P.AssetStockAdjust);
    for (const userId of recipients) {
      await this.notifications.notify(
        userId,
        NotificationType.AssetLowStock,
        `Low stock: ${category.name} at ${location.name}`,
        `Only ${event.quantity} left (threshold ${event.minQuantity}).`,
        '/assets?tab=consumables',
      );
    }
  }

  // ── Warranty-expiring nightly job ───────────────────────────────────────────

  // Every day at 07:00; alerts on units whose warranty expires in the next 30 days.
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async warrantyExpiryCheck() {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() + 30);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const todayIso = now.toISOString().slice(0, 10);

    const expiring = await this.unitRepo
      .createQueryBuilder('u')
      .where('u.warranty_until IS NOT NULL')
      .andWhere('u.warranty_until <= :cutoff', { cutoff: cutoffIso })
      .andWhere('u.warranty_until >= :today', { today: todayIso })
      .andWhere("u.status <> 'retired'")
      .getMany();

    if (!expiring.length) return;
    const recipients = await this.usersWithPermission(P.AssetUnitUpdate);
    for (const unit of expiring) {
      for (const userId of recipients) {
        await this.notifications.notify(
          userId,
          NotificationType.AssetWarrantyExpiring,
          `Warranty expiring: ${unit.assetTag}`,
          `Unit "${unit.name}" (${unit.assetTag}) warranty ends ${unit.warrantyUntil}.`,
          `/assets/${unit.id}`,
        );
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Resolve the set of user ids that hold the given permission key (via any role).
  private async usersWithPermission(permissionKey: string): Promise<string[]> {
    const rows: Array<{ user_id: string }> = await this.dataSource.query(
      `SELECT DISTINCT ur.user_id
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.key = $1`,
      [permissionKey],
    );
    return rows.map((r) => r.user_id);
  }
}
