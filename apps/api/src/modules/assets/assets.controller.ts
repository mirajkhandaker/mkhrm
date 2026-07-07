import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permission, AssetPurchaseStatus, AssetUnitStatus } from '@hrm/types';

import { CategoriesService } from './services/categories.service';
import { LocationsService } from './services/locations.service';
import { ConditionsService } from './services/conditions.service';
import { UnitsService } from './services/units.service';
import { StockService } from './services/stock.service';
import { PurchasesService } from './services/purchases.service';
import { MaintenanceService } from './services/maintenance.service';
import { AssetsImportService } from './services/assets-import.service';

import { CreateAssetCategoryDto, UpdateAssetCategoryDto } from './dto/category.dto';
import { CreateAssetLocationDto, UpdateAssetLocationDto } from './dto/location.dto';
import { CreateAssetConditionDto, UpdateAssetConditionDto } from './dto/condition.dto';
import { CreateAssetPurchaseDto } from './dto/purchase.dto';
import { AssignUnitDto, RetireUnitDto, ReturnUnitDto, TransferUnitDto, UpdateUnitDto } from './dto/unit.dto';
import { IssueConsumableDto, SetMinQuantityDto, StockAdjustDto } from './dto/stock.dto';
import { EndMaintenanceDto, StartMaintenanceDto } from './dto/maintenance.dto';

@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(
    private categoriesService: CategoriesService,
    private locationsService: LocationsService,
    private conditionsService: ConditionsService,
    private unitsService: UnitsService,
    private stockService: StockService,
    private purchasesService: PurchasesService,
    private maintenanceService: MaintenanceService,
    private importService: AssetsImportService,
  ) {}

  // ── CSV / XLSX bulk import for existing units ──────────────────────────────

  @Post('units/import')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitCreate)
  @UseInterceptors(FileInterceptor('file'))
  importUnits(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return this.importService.importUnits(user.sub, file);
  }

  // ── Config: categories / locations / conditions ─────────────────────────────

  @Get('categories') listCategories() { return this.categoriesService.list(); }

  @Post('categories')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetCategoryManage)
  createCategory(@Body() dto: CreateAssetCategoryDto) { return this.categoriesService.create(dto); }

  @Patch('categories/:id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetCategoryManage)
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetCategoryManage)
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) { return this.categoriesService.remove(id); }

  @Get('locations') listLocations() { return this.locationsService.list(); }

  @Post('locations')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetLocationManage)
  createLocation(@Body() dto: CreateAssetLocationDto) { return this.locationsService.create(dto); }

  @Patch('locations/:id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetLocationManage)
  updateLocation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete('locations/:id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetLocationManage)
  deleteLocation(@Param('id', ParseUUIDPipe) id: string) { return this.locationsService.remove(id); }

  @Get('conditions') listConditions() { return this.conditionsService.list(); }

  @Post('conditions')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetConditionManage)
  createCondition(@Body() dto: CreateAssetConditionDto) { return this.conditionsService.create(dto); }

  @Patch('conditions/:id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetConditionManage)
  updateCondition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetConditionDto) {
    return this.conditionsService.update(id, dto);
  }

  @Delete('conditions/:id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetConditionManage)
  deleteCondition(@Param('id', ParseUUIDPipe) id: string) { return this.conditionsService.remove(id); }

  // ── Purchases ───────────────────────────────────────────────────────────────

  @Get('purchases')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetPurchaseCreate)
  listPurchases(@Query('status') status?: AssetPurchaseStatus) {
    return this.purchasesService.list(status);
  }

  @Get('purchases/:id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetPurchaseCreate)
  getPurchase(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.findOne(id);
  }

  @Post('purchases')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetPurchaseCreate)
  createPurchase(@CurrentUser() user: JwtPayload, @Body() dto: CreateAssetPurchaseDto) {
    return this.purchasesService.create(user.sub, dto);
  }

  @Post('purchases/:id/receive')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetPurchaseReceive)
  receivePurchase(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.purchasesService.receive(id, user.sub);
  }

  @Post('purchases/:id/cancel')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetPurchaseCreate)
  cancelPurchase(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.cancel(id);
  }

  // ── Consumable stock ────────────────────────────────────────────────────────

  @Get('stock')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitRead)
  listStock(@Query('categoryId') categoryId?: string, @Query('locationId') locationId?: string) {
    return this.stockService.list({ categoryId, locationId });
  }

  @Get('stock/issued')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitRead)
  listIssued(
    @Query('categoryId') categoryId?: string,
    @Query('locationId') locationId?: string,
    @Query('toEmployeeId') toEmployeeId?: string,
  ) {
    return this.stockService.listIssued({ categoryId, locationId, toEmployeeId });
  }

  @Post('stock/adjust')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetStockAdjust)
  adjustStock(@CurrentUser() user: JwtPayload, @Body() dto: StockAdjustDto) {
    return this.stockService.adjust(user.sub, dto);
  }

  @Post('stock/issue')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetStockIssue)
  issueConsumable(@CurrentUser() user: JwtPayload, @Body() dto: IssueConsumableDto) {
    return this.stockService.issueConsumable(user.sub, dto);
  }

  @Patch('stock/:id/min')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetStockAdjust)
  setMin(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetMinQuantityDto) {
    return this.stockService.setMinQuantity(id, dto);
  }

  // ── Units ───────────────────────────────────────────────────────────────────

  @Get('my') listMine(@CurrentUser() user: JwtPayload) {
    return this.unitsService.listMine(user.sub);
  }

  @Get()
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitRead)
  listUnits(
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: AssetUnitStatus,
    @Query('locationId') locationId?: string,
    @Query('holderEmployeeId') holderEmployeeId?: string,
  ) {
    return this.unitsService.list({ categoryId, status, locationId, holderEmployeeId });
  }

  @Get(':id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitRead)
  getUnit(@Param('id', ParseUUIDPipe) id: string) { return this.unitsService.findOne(id); }

  @Get(':id/history')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitRead)
  history(@Param('id', ParseUUIDPipe) id: string) { return this.unitsService.movementHistory(id); }

  @Patch(':id')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitUpdate)
  updateUnit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Post(':id/assign')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitAssign)
  assignUnit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload, @Body() dto: AssignUnitDto) {
    return this.unitsService.requestAssign(id, user.sub, dto);
  }

  @Post(':id/return')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitAssign)
  returnUnit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload, @Body() dto: ReturnUnitDto) {
    return this.unitsService.returnToStock(id, user.sub, dto);
  }

  @Post(':id/transfer')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitTransfer)
  transferUnit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload, @Body() dto: TransferUnitDto) {
    return this.unitsService.transfer(id, user.sub, dto);
  }

  @Post(':id/retire')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitRetire)
  retireUnit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload, @Body() dto: RetireUnitDto) {
    return this.unitsService.retire(id, user.sub, dto.reason);
  }

  // ── Maintenance ─────────────────────────────────────────────────────────────

  @Get(':id/maintenance')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetUnitRead)
  listMaintenance(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.listForUnit(id);
  }

  @Post('maintenance/start')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetMaintenanceLog)
  startMaintenance(@CurrentUser() user: JwtPayload, @Body() dto: StartMaintenanceDto) {
    return this.maintenanceService.start(user.sub, dto);
  }

  @Post('maintenance/:id/end')
  @UseGuards(PermissionsGuard) @Permissions(Permission.AssetMaintenanceLog)
  endMaintenance(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload, @Body() dto: EndMaintenanceDto) {
    return this.maintenanceService.end(id, user.sub, dto);
  }
}
