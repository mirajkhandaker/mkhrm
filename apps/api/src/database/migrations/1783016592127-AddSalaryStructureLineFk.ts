import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSalaryStructureLineFk1783016592127 implements MigrationInterface {
    name = 'AddSalaryStructureLineFk1783016592127'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "salary_structure_lines" ADD CONSTRAINT "FK_e0871b0da63c42f5838802bf3a9" FOREIGN KEY ("salary_structure_id") REFERENCES "employee_salary_structures"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "salary_structure_lines" DROP CONSTRAINT "FK_e0871b0da63c42f5838802bf3a9"`);
    }

}
