import { MigrationInterface, QueryRunner } from "typeorm";

export class TravelItemDescriptionRoute1783175588999 implements MigrationInterface {
    name = 'TravelItemDescriptionRoute1783175588999'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // description replaces the old free-text "destination" — backfill existing values
        // before dropping the column so nothing is lost.
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "description" text`);
        await queryRunner.query(`UPDATE "travel_request_items" SET "description" = "destination"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ALTER COLUMN "description" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "destination"`);

        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "from_location" character varying`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "to_location" character varying`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "is_round_trip" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "is_round_trip"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "to_location"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "from_location"`);

        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "destination" character varying`);
        await queryRunner.query(`UPDATE "travel_request_items" SET "destination" = "description"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ALTER COLUMN "destination" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "description"`);
    }

}
