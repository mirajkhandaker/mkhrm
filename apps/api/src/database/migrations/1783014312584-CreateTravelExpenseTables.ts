import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTravelExpenseTables1783014312584 implements MigrationInterface {
    name = 'CreateTravelExpenseTables1783014312584'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."travel_requests_transport_mode_enum" AS ENUM('flight', 'train', 'bus', 'car', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."travel_requests_status_enum" AS ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "travel_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "purpose" character varying NOT NULL, "destination" character varying NOT NULL, "from_date" date NOT NULL, "to_date" date NOT NULL, "transport_mode" "public"."travel_requests_transport_mode_enum", "estimated_cost" numeric(14,2) NOT NULL DEFAULT '0', "advance_requested" numeric(14,2) NOT NULL DEFAULT '0', "status" "public"."travel_requests_status_enum" NOT NULL DEFAULT 'pending', "approval_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_be192ec24607f5dcf092829fcef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."expense_claims_status_enum" AS ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled', 'reimbursed')`);
        await queryRunner.query(`CREATE TABLE "expense_claims" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "travel_request_id" uuid, "title" character varying NOT NULL, "total_amount" numeric(14,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL DEFAULT 'BDT', "status" "public"."expense_claims_status_enum" NOT NULL DEFAULT 'pending', "approval_id" uuid, "reimbursed_at" TIMESTAMP WITH TIME ZONE, "reimbursement_ref" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_df3bf7ea3a3a31e39525a322ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."expense_items_category_enum" AS ENUM('travel', 'lodging', 'meals', 'misc')`);
        await queryRunner.query(`CREATE TABLE "expense_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expense_claim_id" uuid NOT NULL, "category" "public"."expense_items_category_enum" NOT NULL, "description" text NOT NULL, "amount" numeric(14,2) NOT NULL, "spent_on" date NOT NULL, "receipt_url" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6fd381fa4fa54678572a7aa534d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD CONSTRAINT "FK_6fdae26a9f572ab3cd6c393bb2e" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD CONSTRAINT "FK_76f76101b79aa071c5374444514" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_claims" ADD CONSTRAINT "FK_578da3eb74f229804e247350136" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_claims" ADD CONSTRAINT "FK_6e6cf84d7d640987b32a11187a0" FOREIGN KEY ("travel_request_id") REFERENCES "travel_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_claims" ADD CONSTRAINT "FK_4e67bcfefd660663d26ca4c899e" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_items" ADD CONSTRAINT "FK_7de76e5acd88e2eed52792f4cbd" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expense_items" DROP CONSTRAINT "FK_7de76e5acd88e2eed52792f4cbd"`);
        await queryRunner.query(`ALTER TABLE "expense_claims" DROP CONSTRAINT "FK_4e67bcfefd660663d26ca4c899e"`);
        await queryRunner.query(`ALTER TABLE "expense_claims" DROP CONSTRAINT "FK_6e6cf84d7d640987b32a11187a0"`);
        await queryRunner.query(`ALTER TABLE "expense_claims" DROP CONSTRAINT "FK_578da3eb74f229804e247350136"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP CONSTRAINT "FK_76f76101b79aa071c5374444514"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP CONSTRAINT "FK_6fdae26a9f572ab3cd6c393bb2e"`);
        await queryRunner.query(`DROP TABLE "expense_items"`);
        await queryRunner.query(`DROP TYPE "public"."expense_items_category_enum"`);
        await queryRunner.query(`DROP TABLE "expense_claims"`);
        await queryRunner.query(`DROP TYPE "public"."expense_claims_status_enum"`);
        await queryRunner.query(`DROP TABLE "travel_requests"`);
        await queryRunner.query(`DROP TYPE "public"."travel_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."travel_requests_transport_mode_enum"`);
    }

}
