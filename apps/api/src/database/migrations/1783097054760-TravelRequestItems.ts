import { MigrationInterface, QueryRunner } from "typeorm";

export class TravelRequestItems1783097054760 implements MigrationInterface {
    name = 'TravelRequestItems1783097054760'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."travel_request_items_transport_mode_enum" AS ENUM('flight', 'train', 'bus', 'car', 'other')`);
        await queryRunner.query(`CREATE TABLE "travel_request_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "travel_request_id" uuid NOT NULL, "destination" character varying NOT NULL, "transport_mode" "public"."travel_request_items_transport_mode_enum", "travel_date" date NOT NULL, "estimated_cost" numeric(14,2) NOT NULL, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_68b64f2da8c762f689f87123031" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "transport_mode"`);
        await queryRunner.query(`DROP TYPE "public"."travel_requests_transport_mode_enum"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "destination"`);
        await queryRunner.query(`ALTER TABLE "travel_request_items" ADD CONSTRAINT "FK_4221c552fec1a05b7f1bb6eb575" FOREIGN KEY ("travel_request_id") REFERENCES "travel_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "travel_request_items" DROP CONSTRAINT "FK_4221c552fec1a05b7f1bb6eb575"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "destination" character varying NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."travel_requests_transport_mode_enum" AS ENUM('flight', 'train', 'bus', 'car', 'other')`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "transport_mode" "public"."travel_requests_transport_mode_enum"`);
        await queryRunner.query(`DROP TABLE "travel_request_items"`);
        await queryRunner.query(`DROP TYPE "public"."travel_request_items_transport_mode_enum"`);
    }

}
