import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentToDesignation1783449293130 implements MigrationInterface {
    name = 'AddDepartmentToDesignation1783449293130'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "designations" ADD "department_id" uuid`);
        await queryRunner.query(`ALTER TABLE "designations" ADD CONSTRAINT "FK_97884615dba807341722aa7aa4b" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "designations" DROP CONSTRAINT "FK_97884615dba807341722aa7aa4b"`);
        await queryRunner.query(`ALTER TABLE "designations" DROP COLUMN "department_id"`);
    }

}
