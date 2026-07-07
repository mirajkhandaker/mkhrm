import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocumentsEducationPreviousEmployment1783360842163 implements MigrationInterface {
    name = 'AddDocumentsEducationPreviousEmployment1783360842163'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "previous_employments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "company_name" character varying NOT NULL, "designation" character varying, "from_date" date NOT NULL, "to_date" date, "reason_for_leaving" text, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6747861ba1f7b66308ed6d50cf0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."education_degree_enum" AS ENUM('ssc', 'hsc', 'diploma', 'bachelors', 'masters', 'phd', 'other')`);
        await queryRunner.query(`CREATE TABLE "education" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "employee_id" uuid NOT NULL, "degree" "public"."education_degree_enum" NOT NULL, "institution" character varying NOT NULL, "field_of_study" character varying, "result" character varying, "start_year" integer, "end_year" integer, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bf3d38701b3030a8ad634d43bd6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "file_name" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "mime_type" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "documents" ADD "file_size_bytes" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "previous_employments" ADD CONSTRAINT "FK_644b298e7dec29a147b71febe0e" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "education" ADD CONSTRAINT "FK_fd8db9c406675aedca4b1f32dc1" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "education" DROP CONSTRAINT "FK_fd8db9c406675aedca4b1f32dc1"`);
        await queryRunner.query(`ALTER TABLE "previous_employments" DROP CONSTRAINT "FK_644b298e7dec29a147b71febe0e"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "file_size_bytes"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "mime_type"`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "file_name"`);
        await queryRunner.query(`DROP TABLE "education"`);
        await queryRunner.query(`DROP TYPE "public"."education_degree_enum"`);
        await queryRunner.query(`DROP TABLE "previous_employments"`);
    }

}
