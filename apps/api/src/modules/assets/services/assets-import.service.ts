import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  AssetHolderType,
  AssetMovementType,
  AssetTrackingMode,
  AssetUnitStatus,
} from '@hrm/types';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { AssetCategory } from '../../../database/entities/assets/asset-category.entity';
import { AssetLocation } from '../../../database/entities/assets/asset-location.entity';
import { AssetCondition } from '../../../database/entities/assets/asset-condition.entity';
import { AssetMovement } from '../../../database/entities/assets/asset-movement.entity';
import { Employee } from '../../../database/entities/employees/employee.entity';

export interface AssetImportResult {
  total: number;
  inserted: number;
  skipped: number; // rows for tags that already exist
  errors: Array<{ row: number; message: string; raw: Record<string, string> }>;
}

// Expected columns (case-insensitive):
//   asset_tag, name, serial_no, category_code, condition_code, location_code,
//   purchase_cost, purchased_on, warranty_until, notes
// Only asset_tag, name, category_code, condition_code, location_code, purchased_on are required.
@Injectable()
export class AssetsImportService {
  constructor(
    @InjectRepository(AssetUnit) private unitRepo: Repository<AssetUnit>,
    @InjectRepository(AssetCategory) private categoryRepo: Repository<AssetCategory>,
    @InjectRepository(AssetLocation) private locationRepo: Repository<AssetLocation>,
    @InjectRepository(AssetCondition) private conditionRepo: Repository<AssetCondition>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private dataSource: DataSource,
  ) {}

  async importUnits(userId: string, file: Express.Multer.File): Promise<AssetImportResult> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('File must be smaller than 5MB');

    const employee = await this.employeeRepo.findOne({ where: { userId } });
    if (!employee) throw new ForbiddenException('Employee profile not found');

    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new BadRequestException('Uploaded file has no sheet');
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '', raw: false });

    // Cache lookup dictionaries once
    const [categories, locations, conditions] = await Promise.all([
      this.categoryRepo.find(),
      this.locationRepo.find(),
      this.conditionRepo.find(),
    ]);
    const catByCode = new Map(categories.map((c) => [c.code.toUpperCase(), c]));
    const locByCode = new Map(locations.map((l) => [l.code.toUpperCase(), l]));
    const condByCode = new Map(conditions.map((c) => [c.code.toUpperCase(), c]));
    const existingTags = new Set(
      (await this.unitRepo.find({ select: ['assetTag'] })).map((u) => u.assetTag),
    );

    const result: AssetImportResult = { total: rows.length, inserted: 0, skipped: 0, errors: [] };

    await this.dataSource.transaction(async (em) => {
      for (let i = 0; i < rows.length; i++) {
        const raw = this.normalizeKeys(rows[i]);
        const rowNum = i + 2; // header row = 1
        try {
          const tag = String(raw.asset_tag ?? '').trim();
          if (!tag) throw new Error('asset_tag is required');
          if (existingTags.has(tag)) { result.skipped += 1; continue; }

          const catCode = String(raw.category_code ?? '').trim().toUpperCase();
          const locCode = String(raw.location_code ?? '').trim().toUpperCase();
          const condCode = String(raw.condition_code ?? '').trim().toUpperCase();
          const category = catByCode.get(catCode);
          const location = locByCode.get(locCode);
          const condition = condByCode.get(condCode);
          if (!category) throw new Error(`Unknown category_code "${catCode}"`);
          if (!location)  throw new Error(`Unknown location_code "${locCode}"`);
          if (!condition) throw new Error(`Unknown condition_code "${condCode}"`);
          if (category.trackingMode !== AssetTrackingMode.Serialized) {
            throw new Error(`Category "${catCode}" is consumable — import only serialized units`);
          }

          const name = String(raw.name ?? category.name).trim();
          const purchasedOn = String(raw.purchased_on ?? '').trim() || new Date().toISOString().slice(0, 10);
          const warrantyUntil = String(raw.warranty_until ?? '').trim() || null;
          const purchaseCost = Number(raw.purchase_cost ?? 0);

          const unit = await em.save(
            AssetUnit,
            em.create(AssetUnit, {
              categoryId: category.id,
              assetTag: tag,
              serialNo: String(raw.serial_no ?? '').trim() || null,
              name,
              purchaseCost,
              purchasedOn,
              warrantyUntil,
              conditionId: condition.id,
              status: AssetUnitStatus.InStock,
              currentHolderType: AssetHolderType.Location,
              currentEmployeeId: null,
              currentDepartmentId: null,
              currentLocationId: location.id,
              currentHolderSince: purchasedOn,
              notes: String(raw.notes ?? '').trim() || null,
            }),
          );
          await em.save(
            AssetMovement,
            em.create(AssetMovement, {
              unitId: unit.id,
              categoryId: category.id,
              movementType: AssetMovementType.StockIn,
              toHolderType: AssetHolderType.Location,
              toHolderId: location.id,
              quantity: 1,
              reference: 'csv-import',
              performedBy: employee.id,
            }),
          );
          existingTags.add(tag);
          result.inserted += 1;
        } catch (err) {
          result.errors.push({
            row: rowNum,
            message: (err as Error).message,
            raw: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)])),
          });
        }
      }
    });

    return result;
  }

  private normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.toLowerCase().trim().replace(/\s+/g, '_')] = v;
    }
    return out;
  }
}
