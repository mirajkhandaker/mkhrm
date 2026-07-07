import { MigrationInterface, QueryRunner } from "typeorm";

export class TravelExpenseCategorySplit1783173683682 implements MigrationInterface {
    name = 'TravelExpenseCategorySplit1783173683682'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Travel item cost date -> date range (a lodging/meals cost can span several days).
        // Add nullable, backfill from the existing single date, then tighten to NOT NULL.
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "travel_date_from" date`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "travel_date_to" date`);
        await queryRunner.query(`UPDATE "travel_request_items" SET "travel_date_from" = "travel_date", "travel_date_to" = "travel_date"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ALTER COLUMN "travel_date_from" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ALTER COLUMN "travel_date_to" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "travel_date"`);

        // Expense claim items are "I paid for something myself" — no category, just the
        // existing free-text description column.
        await queryRunner.query(`ALTER TABLE "expense_items" DROP COLUMN "category"`);
        await queryRunner.query(`DROP TYPE "public"."expense_items_category_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."expense_items_category_enum" AS ENUM('travel', 'lodging', 'meals', 'misc')`);
        await queryRunner.query(`ALTER TABLE "expense_items" ADD "category" "public"."expense_items_category_enum"`);
        await queryRunner.query(`UPDATE "expense_items" SET "category" = 'misc'`);
        await queryRunner.query(`ALTER TABLE "expense_items" ALTER COLUMN "category" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD "travel_date" date`);
        await queryRunner.query(`UPDATE "travel_request_items" SET "travel_date" = "travel_date_from"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ALTER COLUMN "travel_date" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "travel_date_to"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP COLUMN "travel_date_from"`);
    }

}
