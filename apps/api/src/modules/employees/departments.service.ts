import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../database/entities/employees/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private repo: Repository<Department>,
  ) {}

  async findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const dept = await this.repo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.repo.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Code "${dto.code}" already exists`);
    const dept = this.repo.create({
      name: dto.name,
      code: dto.code,
      parentId: dto.parentId ?? null,
    });
    return this.repo.save(dept);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const dept = await this.findOne(id);
    if (dto.code && dto.code !== dept.code) {
      const existing = await this.repo.findOne({ where: { code: dto.code } });
      if (existing) throw new ConflictException(`Code "${dto.code}" already exists`);
    }
    Object.assign(dept, {
      ...(dto.name && { name: dto.name }),
      ...(dto.code && { code: dto.code }),
      ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      ...(dto.headEmployeeId !== undefined && { headEmployeeId: dto.headEmployeeId }),
    });
    return this.repo.save(dept);
  }

  async remove(id: string) {
    const dept = await this.findOne(id);
    await this.repo.remove(dept);
  }
}
