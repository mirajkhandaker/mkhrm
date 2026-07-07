import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Permission } from '@hrm/types';
import { ApprovalsService } from './approvals.service';
import { ActApprovalDto } from './dto/act-approval.dto';
import { CreateWorkflowDto, CreateWorkflowStepDto } from './dto/create-workflow.dto';
import { UpdateWorkflowStepDto } from './dto/update-workflow-step.dto';
import { ReorderStepsDto } from './dto/reorder-steps.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ApprovalsController {
  constructor(private readonly svc: ApprovalsService) {}

  // ── My Approvals inbox ─────────────────────────────────────────────────────

  @Get('approvals/mine')
  getMyApprovals(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyPendingApprovals(user.sub);
  }

  @Get('approvals/:id')
  getApproval(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getApprovalById(id);
  }

  @Post('approvals/:id/act')
  actOnApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.svc.act(id, user.sub, dto);
  }

  // ── Workflow administration ─────────────────────────────────────────────────

  @Get('workflows')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.WorkflowConfigure)
  getWorkflows() {
    return this.svc.findAllWorkflows();
  }

  @Post('workflows')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.WorkflowConfigure)
  createWorkflow(@Body() dto: CreateWorkflowDto) {
    return this.svc.createWorkflow(dto);
  }

  @Patch('workflows/:id/toggle')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.WorkflowConfigure)
  toggleWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.svc.setWorkflowActive(id, body.isActive);
  }

  @Post('workflows/:id/steps')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.WorkflowConfigure)
  addStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWorkflowStepDto,
  ) {
    return this.svc.addStep(id, dto);
  }

  @Patch('workflows/:id/steps/:stepId')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.WorkflowConfigure)
  updateStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: UpdateWorkflowStepDto,
  ) {
    return this.svc.updateStep(id, stepId, dto);
  }

  @Delete('workflows/:id/steps/:stepId')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.WorkflowConfigure)
  removeStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.svc.removeStep(id, stepId);
  }

  @Patch('workflows/:id/steps/reorder')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.WorkflowConfigure)
  reorderSteps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderStepsDto,
  ) {
    return this.svc.reorderSteps(id, dto.stepIds);
  }
}
