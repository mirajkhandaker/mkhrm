import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompensationTables1750003000000 implements MigrationInterface {
  name = 'CreateCompensationTables1750003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(`CREATE TYPE "salary_component_type" AS ENUM ('earning', 'deduction')`);
    await queryRunner.query(`CREATE TYPE "salary_calc_type" AS ENUM ('fixed', 'percent_of_basic', 'percent_of_gross', 'remainder')`);
    await queryRunner.query(`CREATE TYPE "input_basis" AS ENUM ('basic', 'gross')`);
    await queryRunner.query(`CREATE TYPE "salary_structure_status" AS ENUM ('draft', 'active', 'superseded')`);
    await queryRunner.query(`CREATE TYPE "salary_revision_reason" AS ENUM ('initial', 'increment', 'promotion', 'revision')`);
    await queryRunner.query(`CREATE TYPE "pf_base" AS ENUM ('basic', 'gross', 'custom')`);
    await queryRunner.query(`CREATE TYPE "pf_status" AS ENUM ('active', 'stopped')`);
    await queryRunner.query(`CREATE TYPE "benefit_type" AS ENUM ('gratuity', 'insurance', 'bonus', 'loan', 'transport', 'other')`);
    await queryRunner.query(`CREATE TYPE "benefit_value_type" AS ENUM ('amount', 'percent', 'text')`);

    await queryRunner.query(`
      CREATE TABLE "salary_components" (
        "id"            uuid                    NOT NULL DEFAULT gen_random_uuid(),
        "name"          varchar                 NOT NULL,
        "code"          varchar                 NOT NULL,
        "type"          "salary_component_type" NOT NULL,
        "calc_type"     "salary_calc_type"      NOT NULL,
        "default_value" numeric(14,2),
        "is_pf_applicable" boolean             NOT NULL DEFAULT false,
        "is_taxable"    boolean                 NOT NULL DEFAULT false,
        "display_order" int                     NOT NULL DEFAULT 0,
        "is_active"     boolean                 NOT NULL DEFAULT true,
        "created_at"    timestamptz             NOT NULL DEFAULT now(),
        "updated_at"    timestamptz             NOT NULL DEFAULT now(),
        CONSTRAINT "PK_salary_components" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_salary_components_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "salary_grades" (
        "id"               uuid         NOT NULL DEFAULT gen_random_uuid(),
        "name"             varchar      NOT NULL,
        "basic_definition" "input_basis" NOT NULL,
        "rules"            jsonb,
        "created_at"       timestamptz  NOT NULL DEFAULT now(),
        "updated_at"       timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_salary_grades" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_salary_structures" (
        "id"            uuid                      NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"   uuid                      NOT NULL,
        "effective_from" date                     NOT NULL,
        "effective_to"  date,
        "input_basis"   "input_basis"             NOT NULL,
        "input_amount"  numeric(14,2)             NOT NULL,
        "basic_amount"  numeric(14,2)             NOT NULL,
        "gross_amount"  numeric(14,2)             NOT NULL,
        "ctc_amount"    numeric(14,2)             NOT NULL,
        "currency"      varchar                   NOT NULL DEFAULT 'BDT',
        "reason"        "salary_revision_reason"  NOT NULL,
        "status"        "salary_structure_status" NOT NULL DEFAULT 'draft',
        "approved_by"   uuid,
        "created_by"    uuid                      NOT NULL,
        "created_at"    timestamptz               NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_salary_structures" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ess_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ess_employee" ON "employee_salary_structures" ("employee_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ess_status"   ON "employee_salary_structures" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "salary_structure_lines" (
        "id"                  uuid               NOT NULL DEFAULT gen_random_uuid(),
        "salary_structure_id" uuid               NOT NULL,
        "component_id"        uuid               NOT NULL,
        "calc_type"           "salary_calc_type" NOT NULL,
        "input_value"         numeric(14,2),
        "computed_amount"     numeric(14,2)      NOT NULL,
        CONSTRAINT "PK_salary_structure_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ssl_structure"  FOREIGN KEY ("salary_structure_id") REFERENCES "employee_salary_structures"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ssl_component"  FOREIGN KEY ("component_id")        REFERENCES "salary_components"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ssl_structure" ON "salary_structure_lines" ("salary_structure_id")`);

    await queryRunner.query(`
      CREATE TABLE "pf_accounts" (
        "id"                      uuid        NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"             uuid        NOT NULL,
        "pf_number"               varchar,
        "enrolled_on"             date        NOT NULL,
        "employee_contrib_percent" numeric(5,2) NOT NULL DEFAULT 10,
        "employer_contrib_percent" numeric(5,2) NOT NULL DEFAULT 10,
        "pf_base"                 "pf_base"   NOT NULL DEFAULT 'basic',
        "status"                  "pf_status" NOT NULL DEFAULT 'active',
        "created_at"              timestamptz NOT NULL DEFAULT now(),
        "updated_at"              timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pf_accounts"    PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pf_accounts_emp" UNIQUE ("employee_id"),
        CONSTRAINT "FK_pf_employee"    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employee_benefits" (
        "id"            uuid                NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"   uuid                NOT NULL,
        "type"          "benefit_type"      NOT NULL,
        "description"   text,
        "value_type"    "benefit_value_type" NOT NULL,
        "value"         varchar             NOT NULL,
        "effective_from" date               NOT NULL,
        "effective_to"  date,
        "note"          text,
        "created_at"    timestamptz         NOT NULL DEFAULT now(),
        "updated_at"    timestamptz         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_benefits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_eb_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_eb_employee" ON "employee_benefits" ("employee_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "employee_benefits"`);
    await queryRunner.query(`DROP TABLE "pf_accounts"`);
    await queryRunner.query(`DROP TABLE "salary_structure_lines"`);
    await queryRunner.query(`DROP TABLE "employee_salary_structures"`);
    await queryRunner.query(`DROP TABLE "salary_grades"`);
    await queryRunner.query(`DROP TABLE "salary_components"`);
    await queryRunner.query(`DROP TYPE "benefit_value_type"`);
    await queryRunner.query(`DROP TYPE "benefit_type"`);
    await queryRunner.query(`DROP TYPE "pf_status"`);
    await queryRunner.query(`DROP TYPE "pf_base"`);
    await queryRunner.query(`DROP TYPE "salary_revision_reason"`);
    await queryRunner.query(`DROP TYPE "salary_structure_status"`);
    await queryRunner.query(`DROP TYPE "input_basis"`);
    await queryRunner.query(`DROP TYPE "salary_calc_type"`);
    await queryRunner.query(`DROP TYPE "salary_component_type"`);
  }
}
