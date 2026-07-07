import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokenHash1783078055980 implements MigrationInterface {
    name = 'AddRefreshTokenHash1783078055980'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "current_refresh_token_hash" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "current_refresh_token_hash"`);
    }

}
