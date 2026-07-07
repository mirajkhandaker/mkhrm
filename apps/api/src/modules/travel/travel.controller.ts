import {
  Controller,
  Get,
  Post,
  Patch,
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
import { TravelService } from './travel.service';
import { CreateTravelRequestDto } from './dto/create-travel-request.dto';
import { UpdateTravelRequestDto } from './dto/update-travel-request.dto';
import { SubmitSettlementDto } from './dto/submit-settlement.dto';
import { ReimburseTravelDto } from './dto/reimburse-travel.dto';

@UseGuards(JwtAuthGuard)
@Controller('travel')
export class TravelController {
  constructor(private readonly svc: TravelService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.TravelCreate)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTravelRequestDto) {
    return this.svc.createTravelRequest(user.sub, dto);
  }

  @Get()
  getMine(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyTravelRequests(user.sub);
  }

  @Get('approved/mine')
  getApprovedMine(@CurrentUser() user: JwtPayload) {
    return this.svc.getApprovedTravelRequestsForUser(user.sub);
  }

  @Get('all')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.TravelApprove)
  getAll(@Query('status') status?: string) {
    return this.svc.getAllTravelRequests(status);
  }

  @Get('reimbursable')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.TravelReimburse)
  getReimbursable() {
    return this.svc.getReimbursableTravelRequests();
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const canViewAll = user.permissions.includes(Permission.TravelApprove);
    return this.svc.getTravelRequestById(id, user.sub, canViewAll);
  }

  @Get(':id/changes')
  getChanges(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getChangeLog(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTravelRequestDto,
  ) {
    return this.svc.updateTravelRequest(id, user.sub, dto);
  }

  @Patch(':id/settlement')
  submitSettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitSettlementDto,
  ) {
    return this.svc.submitSettlement(id, user.sub, dto);
  }

  @Post(':id/settlement/lock')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.TravelSettle)
  lockSettlement(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.lockSettlement(id, user.sub);
  }

  @Post(':id/reimburse')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.TravelReimburse)
  reimburse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReimburseTravelDto) {
    return this.svc.reimburseTravelRequest(id, dto);
  }

  @Delete(':id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.cancelTravelRequest(id, user.sub);
  }
}
