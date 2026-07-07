import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workflow } from '../../database/entities/approvals/workflow.entity';
import { WorkflowStep } from '../../database/entities/approvals/workflow-step.entity';
import { Approval } from '../../database/entities/approvals/approval.entity';
import { ApprovalActionRecord } from '../../database/entities/approvals/approval-action.entity';
import { Employee } from '../../database/entities/employees/employee.entity';
import { Department } from '../../database/entities/employees/department.entity';
import { Role } from '../../database/entities/auth/role.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workflow,
      WorkflowStep,
      Approval,
      ApprovalActionRecord,
      Employee,
      Department,
      Role,
    ]),
    AuthModule,
  ],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService, TypeOrmModule],
})
export class ApprovalsModule {}
