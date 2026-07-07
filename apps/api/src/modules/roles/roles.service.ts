import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ApproverType } from '@hrm/types';
import { Role } from '../../database/entities/auth/role.entity';
import { Permission } from '../../database/entities/auth/permission.entity';
import { WorkflowStep } from '../../database/entities/approvals/workflow-step.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permissionRepo: Repository<Permission>,
    @InjectRepository(WorkflowStep) private stepRepo: Repository<WorkflowStep>,
  ) {}

  async findAll() {
    const roles = await this.roleRepo.find({
      relations: ['permissions', 'users'],
      order: { name: 'ASC' },
    });
    return roles.map((r) => this.toSummary(r));
  }

  async findOne(id: string) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['permissions', 'users'] });
    if (!role) throw new NotFoundException('Role not found');
    return this.toSummary(role);
  }

  findAllPermissions() {
    return this.permissionRepo.find({ order: { key: 'ASC' } });
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`A role named "${dto.name}" already exists`);

    const permissions = await this.resolvePermissions(dto.permissionIds);
    const role = this.roleRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      permissions,
    });
    return this.roleRepo.save(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.name && dto.name !== role.name) {
      const clash = await this.roleRepo.findOne({ where: { name: dto.name } });
      if (clash) throw new ConflictException(`A role named "${dto.name}" already exists`);
    }

    Object.assign(role, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
    });
    return this.roleRepo.save(role);
  }

  async setPermissions(id: string, dto: SetRolePermissionsDto) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Role not found');

    role.permissions = await this.resolvePermissions(dto.permissionIds);
    return this.roleRepo.save(role);
  }

  async remove(id: string) {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['users'] });
    if (!role) throw new NotFoundException('Role not found');

    if (role.users?.length) {
      throw new ConflictException(`Cannot delete role: ${role.users.length} user(s) still assigned`);
    }

    const stepCount = await this.stepRepo.count({
      where: { approverType: ApproverType.Role, approverRef: id },
    });
    if (stepCount > 0) {
      throw new ConflictException(`Cannot delete role: referenced by ${stepCount} workflow step(s)`);
    }

    await this.roleRepo.delete(id);
    return { deleted: true };
  }

  private async resolvePermissions(permissionIds?: string[]): Promise<Permission[]> {
    if (!permissionIds?.length) return [];
    const permissions = await this.permissionRepo.findBy({ id: In(permissionIds) });
    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissionIds do not exist');
    }
    return permissions;
  }

  private toSummary(role: Role) {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions ?? [],
      userCount: role.users?.length ?? 0,
    };
  }
}
