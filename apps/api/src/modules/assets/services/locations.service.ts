import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetLocation } from '../../../database/entities/assets/asset-location.entity';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { AssetStock } from '../../../database/entities/assets/asset-stock.entity';
import { CreateAssetLocationDto, UpdateAssetLocationDto } from '../dto/location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(AssetLocation) private repo: Repository<AssetLocation>,
    @InjectRepository(AssetUnit) private unitRepo: Repository<AssetUnit>,
    @InjectRepository(AssetStock) private stockRepo: Repository<AssetStock>,
  ) {}

  list() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const loc = await this.repo.findOne({ where: { id } });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  async create(dto: CreateAssetLocationDto) {
    if (await this.repo.findOne({ where: { code: dto.code } })) {
      throw new ConflictException(`Location code "${dto.code}" is already in use`);
    }
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateAssetLocationDto) {
    const loc = await this.findOne(id);
    if (dto.parentId === id) {
      throw new BadRequestException('A location cannot be its own parent');
    }
    Object.assign(loc, dto);
    return this.repo.save(loc);
  }

  async remove(id: string) {
    const inUse =
      (await this.unitRepo.count({ where: { currentLocationId: id } })) > 0 ||
      (await this.stockRepo.count({ where: { locationId: id } })) > 0 ||
      (await this.repo.count({ where: { parentId: id } })) > 0;
    if (inUse) {
      throw new BadRequestException(
        'Cannot delete a location that holds assets, has stock, or has child locations — deactivate it instead.',
      );
    }
    await this.repo.delete({ id });
  }
}
