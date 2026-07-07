import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from '../../database/entities/employees/designation.entity';
import { CreateDesignationDto } from './dto/create-designation.dto';

@Injectable()
export class DesignationsService {
  constructor(
    @InjectRepository(Designation)
    private repo: Repository<Designation>,
  ) {}

  findAll(departmentId?: string) {
    return this.repo.find({
      where: departmentId ? { departmentId } : {},
      relations: ['department'],
      order: { level: 'ASC', title: 'ASC' },
    });
  }

  async findOne(id: string) {
    const d = await this.repo.findOne({ where: { id }, relations: ['department'] });
    if (!d) throw new NotFoundException(`Designation ${id} not found`);
    return d;
  }

  create(dto: CreateDesignationDto) {
    return this.repo.save(
      this.repo.create({
        title: dto.title,
        level: dto.level ?? null,
        departmentId: dto.departmentId ?? null,
      }),
    );
  }

  async update(id: string, dto: Partial<CreateDesignationDto>) {
    const d = await this.findOne(id);
    if (dto.title !== undefined) d.title = dto.title;
    if (dto.level !== undefined) d.level = dto.level ?? null;
    if (dto.departmentId !== undefined) d.departmentId = dto.departmentId ?? null;
    return this.repo.save(d);
  }

  async remove(id: string) {
    const d = await this.findOne(id);
    await this.repo.remove(d);
  }
}
