import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployeeTables1750002000000 implements MigrationInterface {
  name = 'CreateEmployeeTables1750002000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "gender" AS ENUM ('male', 'female', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "employment_type" AS ENUM ('permanent', 'contract', 'intern', 'probation')
    `);
    await queryRunner.query(`
      CREATE TYPE "employment_status" AS ENUM ('probation', 'confirmed', 'notice_period', 'terminated', 'resigned')
    `);
    await queryRunner.query(`
      CREATE TYPE "employee_status" AS ENUM ('active', 'on_leave', 'inactive')
    `);
    await queryRunner.query(`
      CREATE TYPE "job_change_type" AS ENUM ('promotion', 'transfer', 'demotion', 'reassignment')
    `);
    await queryRunner.query(`
      CREATE TYPE "probation_status" AS ENUM ('in_probation', 'confirmed', 'extended', 'failed')
    `);
    await queryRunner.query(`
      CREATE TYPE "employment_status_change_ref" AS ENUM ('probation', 'job_change', 'manual')
    `);
    await queryRunner.query(`
      CREATE TYPE "document_type" AS ENUM ('NID', 'contract', 'certificate', 'other')
    `);

    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id"               uuid    NOT NULL DEFAULT gen_random_uuid(),
        "name"             varchar NOT NULL,
        "code"             varchar NOT NULL,
        "parent_id"        uuid,
        "head_employee_id" uuid,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_departments_code" UNIQUE ("code"),
        CONSTRAINT "FK_departments_parent" FOREIGN KEY ("parent_id") REFERENCES "departments"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "designations" (
        "id"         uuid    NOT NULL DEFAULT gen_random_uuid(),
        "title"      varchar NOT NULL,
        "level"      int,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_designations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id"                uuid               NOT NULL DEFAULT gen_random_uuid(),
        "user_id"           uuid               NOT NULL,
        "employee_code"     varchar            NOT NULL,
        "device_user_id"    varchar,
        "first_name"        varchar            NOT NULL,
        "last_name"         varchar            NOT NULL,
        "dob"               date,
        "gender"            "gender",
        "personal_email"    varchar,
        "phone"             varchar,
        "photo_url"         varchar,
        "address"           text,
        "emergency_contact" jsonb,
        "join_date"         date               NOT NULL,
        "employment_type"   "employment_type"  NOT NULL,
        "employment_status" "employment_status" NOT NULL DEFAULT 'probation',
        "status"            "employee_status"  NOT NULL DEFAULT 'active',
        "department_id"     uuid,
        "designation_id"    uuid,
        "line_manager_id"   uuid,
        "created_at"        timestamptz        NOT NULL DEFAULT now(),
        "updated_at"        timestamptz        NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employees"          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employees_code"     UNIQUE ("employee_code"),
        CONSTRAINT "UQ_employees_user"     UNIQUE ("user_id"),
        CONSTRAINT "FK_employees_user"     FOREIGN KEY ("user_id")         REFERENCES "users"("id"),
        CONSTRAINT "FK_employees_dept"     FOREIGN KEY ("department_id")   REFERENCES "departments"("id"),
        CONSTRAINT "FK_employees_desig"    FOREIGN KEY ("designation_id")  REFERENCES "designations"("id"),
        CONSTRAINT "FK_employees_manager"  FOREIGN KEY ("line_manager_id") REFERENCES "employees"("id")
      )
    `);

    await queryRunner.query(`ALTER TABLE "departments" ADD CONSTRAINT "FK_dept_head" FOREIGN KEY ("head_employee_id") REFERENCES "employees"("id")`);

    await queryRunner.query(`CREATE INDEX "IDX_employees_dept"    ON "employees" ("department_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_employees_manager" ON "employees" ("line_manager_id")`);

    await queryRunner.query(`
      CREATE TABLE "job_changes" (
        "id"                   uuid              NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"          uuid              NOT NULL,
        "type"                 "job_change_type" NOT NULL,
        "effective_date"       date              NOT NULL,
        "from_department_id"   uuid,
        "to_department_id"     uuid,
        "from_designation_id"  uuid,
        "to_designation_id"    uuid,
        "from_manager_id"      uuid,
        "to_manager_id"        uuid,
        "reason"               text,
        "note"                 text,
        "created_by"           uuid NOT NULL,
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_changes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_jc_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_job_changes_employee" ON "job_changes" ("employee_id")`);

    await queryRunner.query(`
      CREATE TABLE "probation_records" (
        "id"                         uuid              NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"                uuid              NOT NULL,
        "start_date"                 date              NOT NULL,
        "probation_months"           int               NOT NULL,
        "expected_confirmation_date" date              NOT NULL,
        "status"                     "probation_status" NOT NULL DEFAULT 'in_probation',
        "confirmed_on"               date,
        "extended_to"                date,
        "evaluator_id"               uuid,
        "note"                       text,
        "created_at"                 timestamptz NOT NULL DEFAULT now(),
        "updated_at"                 timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_probation_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pr_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_probation_employee" ON "probation_records" ("employee_id")`);

    await queryRunner.query(`
      CREATE TABLE "employment_status_history" (
        "id"             uuid                          NOT NULL DEFAULT gen_random_uuid(),
        "employee_id"    uuid                          NOT NULL,
        "from_status"    "employment_status",
        "to_status"      "employment_status"           NOT NULL,
        "effective_date" date                          NOT NULL,
        "reason"         text,
        "ref_type"       "employment_status_change_ref",
        "ref_id"         uuid,
        "created_by"     uuid                          NOT NULL,
        "created_at"     timestamptz                   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_esh" PRIMARY KEY ("id"),
        CONSTRAINT "FK_esh_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_esh_employee" ON "employment_status_history" ("employee_id")`);

    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id"          uuid            NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid            NOT NULL,
        "type"        "document_type" NOT NULL,
        "file_url"    varchar         NOT NULL,
        "expiry_date" date,
        "created_at"  timestamptz     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doc_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_documents_employee" ON "documents" ("employee_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "employment_status_history"`);
    await queryRunner.query(`DROP TABLE "probation_records"`);
    await queryRunner.query(`DROP TABLE "job_changes"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT "FK_dept_head"`);
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(`DROP TABLE "designations"`);
    await queryRunner.query(`DROP TABLE "departments"`);
    await queryRunner.query(`DROP TYPE "document_type"`);
    await queryRunner.query(`DROP TYPE "employment_status_change_ref"`);
    await queryRunner.query(`DROP TYPE "probation_status"`);
    await queryRunner.query(`DROP TYPE "job_change_type"`);
    await queryRunner.query(`DROP TYPE "employee_status"`);
    await queryRunner.query(`DROP TYPE "employment_status"`);
    await queryRunner.query(`DROP TYPE "employment_type"`);
    await queryRunner.query(`DROP TYPE "gender"`);
  }
}
