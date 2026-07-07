import { MigrationInterface, QueryRunner } from "typeorm";

export class DynamicApprovalHierarchy1783089460272 implements MigrationInterface {
    name = 'DynamicApprovalHierarchy1783089460272'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflow_steps" ADD "min_metric_value" numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" ADD "max_metric_value" numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "approvals" ADD "metric_value" numeric(14,2)`);
        await queryRunner.query(`ALTER TYPE "public"."workflow_steps_approver_type_enum" RENAME TO "workflow_steps_approver_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."workflow_steps_approver_type_enum" AS ENUM('line_manager', 'role', 'specific_user', 'department_head', 'manager_chain_level')`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" ALTER COLUMN "approver_type" TYPE "public"."workflow_steps_approver_type_enum" USING "approver_type"::"text"::"public"."workflow_steps_approver_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."workflow_steps_approver_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."workflow_steps_approver_type_enum_old" AS ENUM('line_manager', 'role', 'specific_user', 'department_head')`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" ALTER COLUMN "approver_type" TYPE "public"."workflow_steps_approver_type_enum_old" USING "approver_type"::"text"::"public"."workflow_steps_approver_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."workflow_steps_approver_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."workflow_steps_approver_type_enum_old" RENAME TO "workflow_steps_approver_type_enum"`);
        await queryRunner.query(`ALTER TABLE "approvals" DROP COLUMN "metric_value"`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" DROP COLUMN "max_metric_value"`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" DROP COLUMN "min_metric_value"`);
    }

}
