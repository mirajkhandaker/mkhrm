import { MigrationInterface, QueryRunner } from "typeorm";

export class TravelSettlementAttachments1783168540731 implements MigrationInterface {
    name = 'TravelSettlementAttachments1783168540731'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."request_change_logs_entity_type_enum" AS ENUM('travel_request', 'expense_claim')`);
        await queryRunner.query(`CREATE TABLE "request_change_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entity_type" "public"."request_change_logs_entity_type_enum" NOT NULL, "entity_id" uuid NOT NULL, "changed_by" uuid NOT NULL, "change_summary" text NOT NULL, "diff" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e094059fd5fd6a14e97cc281085" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."attachments_owner_type_enum" AS ENUM('travel_request_item', 'expense_item')`);
        await queryRunner.query(`CREATE TABLE "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_type" "public"."attachments_owner_type_enum" NOT NULL, "owner_id" uuid NOT NULL, "file_url" character varying NOT NULL, "file_name" character varying NOT NULL, "mime_type" character varying NOT NULL, "file_size_bytes" integer NOT NULL, "uploaded_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`);
        // Backfill: move each expense item's single legacy receipt_url into the new
        // multi-attachment table before the column is dropped below. mime_type/file_size_bytes
        // aren't recoverable from the old column, so mime_type is guessed from the file
        // extension and file_size_bytes defaults to 0 — display-only metadata, not re-validated.
        await queryRunner.query(`
            INSERT INTO "attachments" ("owner_type", "owner_id", "file_url", "file_name", "mime_type", "file_size_bytes", "uploaded_by", "created_at")
            SELECT
                'expense_item',
                ei."id",
                ei."receipt_url",
                COALESCE(NULLIF(substring(ei."receipt_url" from '[^/]+$'), ''), 'receipt'),
                CASE
                    WHEN ei."receipt_url" ILIKE '%.png' THEN 'image/png'
                    WHEN ei."receipt_url" ILIKE '%.webp' THEN 'image/webp'
                    WHEN ei."receipt_url" ILIKE '%.pdf' THEN 'application/pdf'
                    ELSE 'image/jpeg'
                END,
                0,
                e."user_id",
                ei."created_at"
            FROM "expense_items" ei
            JOIN "expense_claims" ec ON ec."id" = ei."expense_claim_id"
            JOIN "employees" e ON e."id" = ec."employee_id"
            WHERE ei."receipt_url" IS NOT NULL AND ei."receipt_url" <> ''
        `);
        await queryRunner.query(`ALTER TABLE "expense_items" DROP COLUMN "receipt_url"`);
        await queryRunner.query(`ALTER TABLE "approval_actions" ADD "approved_amount" numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "approvals" ADD "approved_amount" numeric(14,2)`);
        await queryRunner.query(`CREATE TYPE "public"."travel_request_items_category_enum" AS ENUM('travel', 'lodging', 'meals', 'misc')`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "category" "public"."travel_request_items_category_enum" NOT NULL DEFAULT 'travel'`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "actual_cost" numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "is_planned" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "approved_advance_amount" numeric(14,2)`);
        await queryRunner.query(`CREATE TYPE "public"."travel_requests_settlement_status_enum" AS ENUM('none', 'pending', 'approved', 'rejected', 'locked')`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "settlement_status" "public"."travel_requests_settlement_status_enum" NOT NULL DEFAULT 'none'`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "actual_cost" numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "net_adjustment" numeric(14,2)`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "settlement_locked_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "settlement_locked_by" uuid`);
        await queryRunner.query(`ALTER TABLE "expense_claims" ADD "approved_amount" numeric(14,2)`);
        await queryRunner.query(`ALTER TYPE "public"."workflows_entity_type_enum" RENAME TO "workflows_entity_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."workflows_entity_type_enum" AS ENUM('leave', 'requisition', 'travel_request', 'travel_settlement', 'expense_claim', 'regularization')`);
        await queryRunner.query(`ALTER TABLE "workflows" ALTER COLUMN "entity_type" TYPE "public"."workflows_entity_type_enum" USING "entity_type"::"text"::"public"."workflows_entity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."workflows_entity_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."approvals_entity_type_enum" RENAME TO "approvals_entity_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."approvals_entity_type_enum" AS ENUM('leave', 'requisition', 'travel_request', 'travel_settlement', 'expense_claim', 'regularization')`);
        await queryRunner.query(`ALTER TABLE "approvals" ALTER COLUMN "entity_type" TYPE "public"."approvals_entity_type_enum" USING "entity_type"::"text"::"public"."approvals_entity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."approvals_entity_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "request_change_logs" ADD CONSTRAINT "FK_ece2437c14e0e14f43e5417629d" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_e25812e3fd9b3f3edf11b2c5d58" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_e25812e3fd9b3f3edf11b2c5d58"`);
        await queryRunner.query(`ALTER TABLE "request_change_logs" DROP CONSTRAINT "FK_ece2437c14e0e14f43e5417629d"`);
        await queryRunner.query(`CREATE TYPE "public"."approvals_entity_type_enum_old" AS ENUM('leave', 'requisition', 'travel_request', 'expense_claim', 'regularization')`);
        await queryRunner.query(`ALTER TABLE "approvals" ALTER COLUMN "entity_type" TYPE "public"."approvals_entity_type_enum_old" USING "entity_type"::"text"::"public"."approvals_entity_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."approvals_entity_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."approvals_entity_type_enum_old" RENAME TO "approvals_entity_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."workflows_entity_type_enum_old" AS ENUM('leave', 'requisition', 'travel_request', 'expense_claim', 'regularization')`);
        await queryRunner.query(`ALTER TABLE "workflows" ALTER COLUMN "entity_type" TYPE "public"."workflows_entity_type_enum_old" USING "entity_type"::"text"::"public"."workflows_entity_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."workflows_entity_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."workflows_entity_type_enum_old" RENAME TO "workflows_entity_type_enum"`);
        await queryRunner.query(`ALTER TABLE "expense_claims" DROP COLUMN "approved_amount"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "settlement_locked_by"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "settlement_locked_at"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "net_adjustment"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "actual_cost"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "settlement_status"`);
        await queryRunner.query(`DROP TYPE "public"."travel_requests_settlement_status_enum"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "approved_advance_amount"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "is_planned"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "actual_cost"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "category"`);
        await queryRunner.query(`DROP TYPE "public"."travel_request_items_category_enum"`);
        await queryRunner.query(`ALTER TABLE "approvals" DROP COLUMN "approved_amount"`);
        await queryRunner.query(`ALTER TABLE "approval_actions" DROP COLUMN "approved_amount"`);
        await queryRunner.query(`ALTER TABLE "expense_items" ADD "receipt_url" character varying`);
        await queryRunner.query(`DROP TABLE "attachments"`);
        await queryRunner.query(`DROP TYPE "public"."attachments_owner_type_enum"`);
        await queryRunner.query(`DROP TABLE "request_change_logs"`);
        await queryRunner.query(`DROP TYPE "public"."request_change_logs_entity_type_enum"`);
    }

}
