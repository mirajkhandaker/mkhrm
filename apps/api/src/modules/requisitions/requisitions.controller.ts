import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permission } from '@hrm/types';
import { RequisitionsService } from './requisitions.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';

@UseGuards(JwtAuthGuard)
@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly svc: RequisitionsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.RequisitionCreate)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRequisitionDto) {
    return this.svc.createRequisition(user.sub, dto);
  }

  @Get()
  getMine(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyRequisitions(user.sub);
  }

  @Get('all')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.RequisitionApprove)
  getAll(@Query('status') status?: string) {
    return this.svc.getAllRequisitions(status);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const canViewAll = user.permissions.includes(Permission.RequisitionApprove);
    return this.svc.getRequisitionById(id, user.sub, canViewAll);
  }

  @Delete(':id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.cancelRequisition(id, user.sub);
  }
}
