import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeaveTables1750005000000 implements MigrationInterface {
  name = 'CreateLeaveTables1750005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "accrual_method" AS ENUM ('none', 'monthly', 'yearly')`);
    await queryRunner.query(`CREATE TYPE "leave_application_status" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "leave_ledger_source" AS ENUM ('accrual', 'application', 'adjustment', 'carry_forward')`);
    await queryRunner.query(`CREATE TYPE "holiday_type" AS ENUM ('government', 'optional', 'company')`);

    await queryRunner.query(`
      CREATE TABLE "holidays" (
        "id"           uuid           NOT NULL DEFAULT gen_random_uuid(),
        "name"         varchar        NOT NULL,
        "date"         date           NOT NULL,
        "type"         "holiday_type" NOT NULL,
        "is_recurring" boolean        NOT NULL DEFAULT false,
        "created_at"   timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_holidays" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_holidays_date" ON "holidays" ("date")`);

    await queryRunner.query(`
      CREATE TABLE "leave_types" (
        "id"                      uuid             NOT NULL DEFAULT gen_random_uuid(),
        "name"                    varchar          NOT NULL,
        "code"                    varchar          NOT NULL,
        "is_paid"                 boolean          NOT NULL DEFAULT true,
        "requires_document"       boolean          NOT NULL DEFAULT false,
        "accrual_method"          "accrual_method" NOT NULL DEFAULT 'none',
        "default_days_per_year"   numeric(5,1)     NOT NULL DEFAULT 0,
        "max_carry_forward"       numeric(5,1)     NOT NULL DEFAULT 0,
        "allow_negative_balance"  boolean          NOT NULL DEFAULT false,
        "color"                   varchar          NOT NULL DEFAULT '#6B8CCF',
        "is_active"               boolean          NOT NULL DEFAULT true,
        "created_at"              timestamptz      NOT NULL DEFAULT now(),
        "updated_at"              timestamptz      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_leave_types_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "leave_policies" (
        "id"            uuid         NOT NULL DEFAULT gen_random_uuid(),
        "leave_type_id" uuid         NOT NULL,
        "applies_to"    varchar      NOT NULL,
        "days_per_year" numeric(5,1) NOT NULL DEFAULT 0,
        "accrual_rate"  numeric(5,2),
        "created_at"    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_policies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_policies_leave_type" FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_leave_policies_leave_type_id" ON "leave_policies" ("leave_type_id")`);

    await queryRunner.query(`
      CREATE TABLE "leave_balances" (
        "id"             uuid         NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"    uuid         NOT NULL,
        "leave_type_id"  uuid         NOT NULL,
        "year"           int          NOT NULL,
        "entitled"       numeric(6,1) NOT NULL DEFAULT 0,
        "accrued"        numeric(6,1) NOT NULL DEFAULT 0,
        "used"           numeric(6,1) NOT NULL DEFAULT 0,
        "pending"        numeric(6,1) NOT NULL DEFAULT 0,
        "carried_forward" numeric(6,1) NOT NULL DEFAULT 0,
        "available"      numeric(6,1) NOT NULL DEFAULT 0,
        "updated_at"     timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_balances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_leave_balances" UNIQUE ("employee_id", "leave_type_id", "year"),
        CONSTRAINT "FK_leave_balances_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id"),
        CONSTRAINT "FK_leave_balances_leave_type" FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_leave_balances_employee_id" ON "leave_balances" ("employee_id")`);

    await queryRunner.query(`
      CREATE TABLE "leave_applications" (
        "id"            uuid                       NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"   uuid                       NOT NULL,
        "leave_type_id" uuid                       NOT NULL,
        "start_date"    date                       NOT NULL,
        "end_date"      date                       NOT NULL,
        "days_count"    numeric(5,1)               NOT NULL,
        "is_half_day"   boolean                    NOT NULL DEFAULT false,
        "reason"        text,
        "document_url"  varchar,
        "status"        "leave_application_status" NOT NULL DEFAULT 'draft',
        "approval_id"   uuid,
        "created_at"    timestamptz                NOT NULL DEFAULT now(),
        "updated_at"    timestamptz                NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_applications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_applications_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id"),
        CONSTRAINT "FK_leave_applications_leave_type" FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types"("id"),
        CONSTRAINT "FK_leave_applications_approval" FOREIGN KEY ("approval_id")
          REFERENCES "approvals"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_leave_applications_employee_id" ON "leave_applications" ("employee_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_leave_applications_status" ON "leave_applications" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_leave_applications_dates" ON "leave_applications" ("start_date", "end_date")`);

    await queryRunner.query(`
      CREATE TABLE "leave_ledger" (
        "id"            uuid                  NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"   uuid                  NOT NULL,
        "leave_type_id" uuid                  NOT NULL,
        "change"        numeric(6,1)          NOT NULL,
        "balance_after" numeric(6,1)          NOT NULL,
        "source"        "leave_ledger_source" NOT NULL,
        "ref_id"        uuid,
        "created_at"    timestamptz           NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leave_ledger" PRIMARY KEY ("id"),
        CONSTRAINT "FK_leave_ledger_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id"),
        CONSTRAINT "FK_leave_ledger_leave_type" FOREIGN KEY ("leave_type_id")
          REFERENCES "leave_types"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_leave_ledger_employee_id" ON "leave_ledger" ("employee_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_leave_ledger_created_at" ON "leave_ledger" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "leave_ledger"`);
    await queryRunner.query(`DROP TABLE "leave_applications"`);
    await queryRunner.query(`DROP TABLE "leave_balances"`);
    await queryRunner.query(`DROP TABLE "leave_policies"`);
    await queryRunner.query(`DROP TABLE "leave_types"`);
    await queryRunner.query(`DROP TABLE "holidays"`);
    await queryRunner.query(`DROP TYPE "leave_ledger_source"`);
    await queryRunner.query(`DROP TYPE "leave_application_status"`);
    await queryRunner.query(`DROP TYPE "accrual_method"`);
    await queryRunner.query(`DROP TYPE "holiday_type"`);
  }
}
