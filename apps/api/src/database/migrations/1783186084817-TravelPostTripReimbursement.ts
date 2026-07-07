import { MigrationInterface, QueryRunner } from "typeorm";

export class TravelPostTripReimbursement1783186084817 implements MigrationInterface {
    name = 'TravelPostTripReimbursement1783186084817'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."travel_requests_timing_enum" AS ENUM('pre_trip', 'post_trip')`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "timing" "public"."travel_requests_timing_enum" NOT NULL DEFAULT 'pre_trip'`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "reimbursed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ADD "reimbursement_ref" character varying`);
        await queryRunner.query(`ALTER TYPE "public"."travel_requests_status_enum" RENAME TO "travel_requests_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."travel_requests_status_enum" AS ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled', 'reimbursed')`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ALTER COLUMN "status" TYPE "public"."travel_requests_status_enum" USING "status"::"text"::"public"."travel_requests_status_enum"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."travel_requests_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('approval_requested', 'approval_approved', 'approval_rejected', 'leave_approved', 'leave_rejected', 'expense_reimbursed', 'travel_reimbursed', 'system')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('approval_requested', 'approval_approved', 'approval_rejected', 'leave_approved', 'leave_rejected', 'expense_reimbursed', 'system')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."travel_requests_status_enum_old" AS ENUM('draft', 'pending', 'approved', 'rejected', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ALTER COLUMN "status" TYPE "public"."travel_requests_status_enum_old" USING "status"::"text"::"public"."travel_requests_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."travel_requests_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."travel_requests_status_enum_old" RENAME TO "travel_requests_status_enum"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "reimbursement_ref"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "reimbursed_at"`);
        await queryRunner.query(`ALTER TABLE "travel_requests" DROP COLUMN "timing"`);
        await queryRunner.query(`DROP TYPE "public"."travel_requests_timing_enum"`);
    }

}
