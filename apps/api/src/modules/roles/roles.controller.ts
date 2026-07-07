import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { Permission } from '@hrm/types';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';

@Controller()
export class RolesController {
  constructor(private readonly svc: RolesService) {}

  @Get('roles')
  @Permissions(Permission.RoleManage)
  findAll() {
    return this.svc.findAll();
  }

  @Get('roles/:id')
  @Permissions(Permission.RoleManage)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Post('roles')
  @Permissions(Permission.RoleManage)
  create(@Body() dto: CreateRoleDto) {
    return this.svc.create(dto);
  }

  @Patch('roles/:id')
  @Permissions(Permission.RoleManage)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.svc.update(id, dto);
  }

  @Put('roles/:id/permissions')
  @Permissions(Permission.RoleManage)
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRolePermissionsDto) {
    return this.svc.setPermissions(id, dto);
  }

  @Delete('roles/:id')
  @Permissions(Permission.RoleManage)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }

  @Get('permissions')
  @Permissions(Permission.RoleManage)
  findAllPermissions() {
    return this.svc.findAllPermissions();
  }
}
