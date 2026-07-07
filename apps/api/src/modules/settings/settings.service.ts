import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../../database/entities/system/setting.entity';

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private readonly settingRepo: Repository<Setting>) {}

  findAll(): Promise<Setting[]> {
    return this.settingRepo.find({ order: { key: 'ASC' } });
  }

  async findOne(key: string): Promise<Setting> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
    return setting;
  }

  async getValue<T>(key: string, fallback: T): Promise<T> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    return setting ? (setting.value as T) : fallback;
  }

  async upsert(key: string, value: unknown): Promise<Setting> {
    const existing = await this.settingRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      return this.settingRepo.save(existing);
    }
    return this.settingRepo.save(this.settingRepo.create({ key, value }));
  }
}
