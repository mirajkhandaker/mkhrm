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
import { ExpenseService } from './expense.service';
import { CreateExpenseClaimDto } from './dto/create-expense-claim.dto';
import { UpdateExpenseClaimDto } from './dto/update-expense-claim.dto';
import { ReimburseExpenseDto } from './dto/reimburse-expense.dto';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly svc: ExpenseService) {}

  // ── Claims ──────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ExpenseCreate)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExpenseClaimDto) {
    return this.svc.createExpenseClaim(user.sub, dto);
  }

  @Get()
  getMine(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyExpenseClaims(user.sub);
  }

  @Get('all')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ExpenseApprove)
  getAll(@Query('status') status?: string) {
    return this.svc.getAllExpenseClaims(status);
  }

  @Get('reimbursable')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ExpenseReimburse)
  getReimbursable() {
    return this.svc.getReimbursableExpenseClaims();
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const canViewAll = user.permissions.includes(Permission.ExpenseApprove)
      || user.permissions.includes(Permission.ExpenseReimburse);
    return this.svc.getExpenseClaimById(id, user.sub, canViewAll);
  }

  @Get(':id/changes')
  getChanges(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getChangeLog(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateExpenseClaimDto,
  ) {
    return this.svc.updateExpenseClaim(id, user.sub, dto);
  }

  @Delete(':id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.cancelExpenseClaim(id, user.sub);
  }

  @Post(':id/reimburse')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.ExpenseReimburse)
  reimburse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReimburseExpenseDto) {
    return this.svc.reimburseExpenseClaim(id, dto);
  }
}
