import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetCategory } from '../../database/entities/assets/asset-category.entity';
import { AssetLocation } from '../../database/entities/assets/asset-location.entity';
import { AssetCondition } from '../../database/entities/assets/asset-condition.entity';
import { AssetUnit } from '../../database/entities/assets/asset-unit.entity';
import { AssetStock } from '../../database/entities/assets/asset-stock.entity';
import { AssetMovement } from '../../database/entities/assets/asset-movement.entity';
import { AssetPurchase } from '../../database/entities/assets/asset-purchase.entity';
import { AssetPurchaseItem } from '../../database/entities/assets/asset-purchase-item.entity';
import { AssetMaintenanceRecord } from '../../database/entities/assets/asset-maintenance-record.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Requisition } from '../../database/entities/requisitions/requisition.entity';

import { AuthModule } from '../auth/auth.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { CategoriesService } from './services/categories.service';
import { LocationsService } from './services/locations.service';
import { ConditionsService } from './services/conditions.service';
import { UnitsService } from './services/units.service';
import { StockService } from './services/stock.service';
import { PurchasesService } from './services/purchases.service';
import { MaintenanceService } from './services/maintenance.service';
import { AssetsEventsListener } from './services/assets-events.listener';
import { AssetsNotificationsListener } from './services/assets-notifications.listener';
import { AssetsImportService } from './services/assets-import.service';

import { AssetsController } from './assets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetCategory,
      AssetLocation,
      AssetCondition,
      AssetUnit,
      AssetStock,
      AssetMovement,
      AssetPurchase,
      AssetPurchaseItem,
      AssetMaintenanceRecord,
      Employee,
      Department,
      Requisition,
    ]),
    AuthModule,
    ApprovalsModule,
    SettingsModule,
    NotificationsModule,
  ],
  providers: [
    CategoriesService,
    LocationsService,
    ConditionsService,
    UnitsService,
    StockService,
    PurchasesService,
    MaintenanceService,
    AssetsEventsListener,
    AssetsNotificationsListener,
    AssetsImportService,
  ],
  controllers: [AssetsController],
  exports: [
    CategoriesService,
    LocationsService,
    ConditionsService,
    UnitsService,
    StockService,
    PurchasesService,
    MaintenanceService,
    TypeOrmModule,
  ],
})
export class AssetsModule {}
