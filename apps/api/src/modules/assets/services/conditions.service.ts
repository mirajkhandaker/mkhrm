import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssetCondition } from '../../../database/entities/assets/asset-condition.entity';
import { AssetUnit } from '../../../database/entities/assets/asset-unit.entity';
import { CreateAssetConditionDto, UpdateAssetConditionDto } from '../dto/condition.dto';

@Injectable()
export class ConditionsService {
  constructor(
    @InjectRepository(AssetCondition) private repo: Repository<AssetCondition>,
    @InjectRepository(AssetUnit) private unitRepo: Repository<AssetUnit>,
  ) {}

  list() {
    return this.repo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Condition not found');
    return c;
  }

  async create(dto: CreateAssetConditionDto) {
    if (await this.repo.findOne({ where: { code: dto.code } })) {
      throw new ConflictException(`Condition code "${dto.code}" is already in use`);
    }
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateAssetConditionDto) {
    const c = await this.findOne(id);
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: string) {
    if ((await this.unitRepo.count({ where: { conditionId: id } })) > 0) {
      throw new BadRequestException(
        'Cannot delete a condition that is referenced by assets — deactivate it instead.',
      );
    }
    await this.repo.delete({ id });
  }
}
