import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApprovalTables1750004000000 implements MigrationInterface {
  name = 'CreateApprovalTables1750004000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "approval_entity_type" AS ENUM ('leave', 'requisition', 'travel_request', 'expense_claim', 'regularization')`);
    await queryRunner.query(`CREATE TYPE "approver_type" AS ENUM ('line_manager', 'role', 'specific_user', 'department_head')`);
    await queryRunner.query(`CREATE TYPE "approval_status" AS ENUM ('pending', 'approved', 'rejected', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "approval_action_type" AS ENUM ('approve', 'reject', 'return', 'comment')`);

    await queryRunner.query(`
      CREATE TABLE "workflows" (
        "id"          uuid                    NOT NULL DEFAULT gen_random_uuid(),
        "name"        varchar                 NOT NULL,
        "entity_type" "approval_entity_type"  NOT NULL,
        "is_active"   boolean                 NOT NULL DEFAULT true,
        "created_at"  timestamptz             NOT NULL DEFAULT now(),
        "updated_at"  timestamptz             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflows" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "workflow_steps" (
        "id"            uuid            NOT NULL DEFAULT gen_random_uuid(),
        "workflow_id"   uuid            NOT NULL,
        "step_order"    int             NOT NULL,
        "approver_type" "approver_type" NOT NULL,
        "approver_ref"  varchar,
        "is_mandatory"  boolean         NOT NULL DEFAULT true,
        "sla_hours"     int,
        "created_at"    timestamptz     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workflow_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_workflow_steps_workflow" FOREIGN KEY ("workflow_id")
          REFERENCES "workflows"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_workflow_steps_workflow_id" ON "workflow_steps" ("workflow_id")`);

    await queryRunner.query(`
      CREATE TABLE "approvals" (
        "id"           uuid                    NOT NULL DEFAULT gen_random_uuid(),
        "workflow_id"  uuid                    NOT NULL,
        "entity_type"  "approval_entity_type"  NOT NULL,
        "entity_id"    uuid                    NOT NULL,
        "current_step" int                     NOT NULL DEFAULT 1,
        "status"       "approval_status"       NOT NULL DEFAULT 'pending',
        "requested_by" uuid                    NOT NULL,
        "created_at"   timestamptz             NOT NULL DEFAULT now(),
        "updated_at"   timestamptz             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approvals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_approvals_workflow" FOREIGN KEY ("workflow_id")
          REFERENCES "workflows"("id"),
        CONSTRAINT "FK_approvals_user" FOREIGN KEY ("requested_by")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_entity" ON "approvals" ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_status" ON "approvals" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_approvals_requested_by" ON "approvals" ("requested_by")`);

    await queryRunner.query(`
      CREATE TABLE "approval_actions" (
        "id"          uuid                    NOT NULL DEFAULT gen_random_uuid(),
        "approval_id" uuid                    NOT NULL,
        "step_order"  int                     NOT NULL,
        "actor_id"    uuid                    NOT NULL,
        "action"      "approval_action_type"  NOT NULL,
        "comment"     text,
        "acted_at"    timestamptz             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_approval_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_approval_actions_approval" FOREIGN KEY ("approval_id")
          REFERENCES "approvals"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_approval_actions_actor" FOREIGN KEY ("actor_id")
          REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_approval_actions_approval_id" ON "approval_actions" ("approval_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "approval_actions"`);
    await queryRunner.query(`DROP TABLE "approvals"`);
    await queryRunner.query(`DROP TABLE "workflow_steps"`);
    await queryRunner.query(`DROP TABLE "workflows"`);
    await queryRunner.query(`DROP TYPE "approval_action_type"`);
    await queryRunner.query(`DROP TYPE "approval_status"`);
    await queryRunner.query(`DROP TYPE "approver_type"`);
    await queryRunner.query(`DROP TYPE "approval_entity_type"`);
  }
}
