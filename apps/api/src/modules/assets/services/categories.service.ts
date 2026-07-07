import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetCategory } from '../../../database/entities/assets/asset-category.entity';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { AssetStock } from '../../../database/entities/assets/asset-stock.entity';
import { CreateAssetCategoryDto, UpdateAssetCategoryDto } from '../dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(AssetCategory) private repo: Repository<AssetCategory>,
    @InjectRepository(AssetUnit) private unitRepo: Repository<AssetUnit>,
    @InjectRepository(AssetStock) private stockRepo: Repository<AssetStock>,
  ) {}

  list() {
    return this.repo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Asset category not found');
    return cat;
  }

  async create(dto: CreateAssetCategoryDto) {
    if (await this.repo.findOne({ where: { code: dto.code } })) {
      throw new ConflictException(`Category code "${dto.code}" is already in use`);
    }
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateAssetCategoryDto) {
    const cat = await this.findOne(id);
    Object.assign(cat, dto);
    return this.repo.save(cat);
  }

  async remove(id: string) {
    const inUse =
      (await this.unitRepo.count({ where: { categoryId: id } })) > 0 ||
      (await this.stockRepo.count({ where: { categoryId: id } })) > 0;
    if (inUse) {
      throw new BadRequestException(
        'Cannot delete a category that has assets or stock — deactivate it instead.',
      );
    }
    await this.repo.delete({ id });
  }
}
