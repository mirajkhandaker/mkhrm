import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDocumentLabel1783363193249 implements MigrationInterface {
    name = 'AddDocumentLabel1783363193249'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" ADD "label" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "label"`);
    }

}
