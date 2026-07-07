import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRequisitionTables1783013214765 implements MigrationInterface {
    name = 'CreateRequisitionTables1783013214765'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."requisitions_type_enum" AS ENUM('asset', 'purchase', 'recruitment')`);
        await queryRunner.query(`CREATE TYPE "public"."requisitions_priority_enum" AS ENUM('low', 'medium', 'high', 'urgent')`);
        await queryRunner.query(`CREATE TYPE "public"."requisitions_status_enum" AS ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "requisitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requester_id" uuid NOT NULL, "type" "public"."requisitions_type_enum" NOT NULL, "title" character varying NOT NULL, "description" text, "priority" "public"."requisitions_priority_enum" NOT NULL DEFAULT 'medium', "needed_by" date, "estimated_cost" numeric(14,2) NOT NULL DEFAULT '0', "status" "public"."requisitions_status_enum" NOT NULL DEFAULT 'pending', "approval_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_be24649237292ddbd473f3ded92" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "requisition_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requisition_id" uuid NOT NULL, "name" character varying NOT NULL, "quantity" integer NOT NULL, "unit_cost" numeric(14,2) NOT NULL, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9abc61153c001d72d089e11c715" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "requisitions" ADD CONSTRAINT "FK_984e59e5ebe1acb885d5750d3dd" FOREIGN KEY ("requester_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requisitions" ADD CONSTRAINT "FK_89509f6e24e6452de1e242e497c" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requisition_items" ADD CONSTRAINT "FK_2afa61cf14fa20efa7dc12883dd" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "requisition_items" DROP CONSTRAINT "FK_2afa61cf14fa20efa7dc12883dd"`);
        await queryRunner.query(`ALTER TABLE "requisitions" DROP CONSTRAINT "FK_89509f6e24e6452de1e242e497c"`);
        await queryRunner.query(`ALTER TABLE "requisitions" DROP CONSTRAINT "FK_984e59e5ebe1acb885d5750d3dd"`);
        await queryRunner.query(`DROP TABLE "requisition_items"`);
        await queryRunner.query(`DROP TABLE "requisitions"`);
        await queryRunner.query(`DROP TYPE "public"."requisitions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."requisitions_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."requisitions_type_enum"`);
    }

}
