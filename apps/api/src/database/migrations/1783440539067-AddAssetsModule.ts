import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssetsModule1783440539067 implements MigrationInterface {
    name = 'AddAssetsModule1783440539067'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."asset_categories_tracking_mode_enum" AS ENUM('serialized', 'consumable')`);
        await queryRunner.query(`CREATE TYPE "public"."asset_categories_depreciation_method_enum" AS ENUM('none', 'straight_line', 'reducing_balance')`);
        await queryRunner.query(`CREATE TABLE "asset_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "name" character varying NOT NULL, "tracking_mode" "public"."asset_categories_tracking_mode_enum" NOT NULL, "depreciation_method" "public"."asset_categories_depreciation_method_enum" NOT NULL DEFAULT 'none', "useful_life_months" integer, "default_warranty_months" integer, "requires_asset_tag" boolean NOT NULL DEFAULT true, "display_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2787593ee8afad9f185bdf3f472" UNIQUE ("code"), CONSTRAINT "PK_d21442187e7b0237566389805a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "asset_conditions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "name" character varying NOT NULL, "display_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_88086d5518d2ab380564eff89eb" UNIQUE ("code"), CONSTRAINT "PK_9875ad9f01258e290dad5aa19bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "asset_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "name" character varying NOT NULL, "parent_id" uuid, "address" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_20e5e2e28c9ac9eb5016eeff2c3" UNIQUE ("code"), CONSTRAINT "PK_46ae4382ba27cc95e93b0517cdb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."asset_units_status_enum" AS ENUM('in_stock', 'assigned', 'in_maintenance', 'retired', 'lost')`);
        await queryRunner.query(`CREATE TYPE "public"."asset_units_current_holder_type_enum" AS ENUM('employee', 'department', 'location')`);
        await queryRunner.query(`CREATE TABLE "asset_units" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category_id" uuid NOT NULL, "asset_tag" character varying NOT NULL, "serial_no" character varying, "name" character varying NOT NULL, "purchase_cost" numeric(14,2) NOT NULL DEFAULT '0', "purchased_on" date NOT NULL, "warranty_until" date, "condition_id" uuid NOT NULL, "status" "public"."asset_units_status_enum" NOT NULL DEFAULT 'in_stock', "current_holder_type" "public"."asset_units_current_holder_type_enum" NOT NULL, "current_employee_id" uuid, "current_department_id" uuid, "current_location_id" uuid, "current_holder_since" date NOT NULL, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_1eb099199fffa6b1742ff874a1" CHECK ((
  (current_holder_type = 'employee'   AND current_employee_id   IS NOT NULL AND current_department_id IS NULL AND current_location_id IS NULL) OR
  (current_holder_type = 'department' AND current_department_id IS NOT NULL AND current_employee_id   IS NULL AND current_location_id IS NULL) OR
  (current_holder_type = 'location'   AND current_location_id   IS NOT NULL AND current_employee_id   IS NULL AND current_department_id IS NULL)
)), CONSTRAINT "PK_25fc28dd4e9ce20f2c94e90ddc1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c8c7819a908c61687755f3662b" ON "asset_units" ("asset_tag") `);
        await queryRunner.query(`CREATE TABLE "asset_stock" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category_id" uuid NOT NULL, "location_id" uuid NOT NULL, "quantity" integer NOT NULL DEFAULT '0', "min_quantity" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_944fbd31cc172623b7ac39b94cd" UNIQUE ("category_id", "location_id"), CONSTRAINT "PK_d127d047543a1f91bb1b1675e1b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "asset_purchase_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "purchase_id" uuid NOT NULL, "category_id" uuid NOT NULL, "quantity" integer NOT NULL, "unit_cost" numeric(14,2) NOT NULL, "warranty_months" integer, "location_id" uuid NOT NULL, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2bbde34afaba9d1d7a833237b51" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."asset_purchases_status_enum" AS ENUM('draft', 'received', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "asset_purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendor" character varying NOT NULL, "invoice_no" character varying, "invoice_date" date NOT NULL, "total_amount" numeric(14,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "linked_requisition_id" uuid, "received_at" TIMESTAMP WITH TIME ZONE, "received_by" uuid, "notes" text, "status" "public"."asset_purchases_status_enum" NOT NULL DEFAULT 'draft', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6937c0af6a8b9ca783e27b48e84" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."asset_movements_movement_type_enum" AS ENUM('stock_in', 'assign', 'return', 'transfer', 'issue_consumable', 'maintenance_in', 'maintenance_out', 'retire', 'write_off')`);
        await queryRunner.query(`CREATE TYPE "public"."asset_movements_from_holder_type_enum" AS ENUM('employee', 'department', 'location')`);
        await queryRunner.query(`CREATE TYPE "public"."asset_movements_to_holder_type_enum" AS ENUM('employee', 'department', 'location')`);
        await queryRunner.query(`CREATE TABLE "asset_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "unit_id" uuid, "category_id" uuid, "movement_type" "public"."asset_movements_movement_type_enum" NOT NULL, "from_holder_type" "public"."asset_movements_from_holder_type_enum", "from_holder_id" uuid, "to_holder_type" "public"."asset_movements_to_holder_type_enum", "to_holder_id" uuid, "quantity" integer NOT NULL DEFAULT '1', "reference" character varying, "note" text, "performed_by" uuid NOT NULL, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f99f755a0dd716f1bad3ff2b313" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."asset_maintenance_records_outcome_enum" AS ENUM('serviced', 'replaced', 'written_off')`);
        await queryRunner.query(`CREATE TABLE "asset_maintenance_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "unit_id" uuid NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, "cost" numeric(14,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "vendor" character varying, "description" text NOT NULL, "outcome" "public"."asset_maintenance_records_outcome_enum", "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0eb6fb007d2a348d8e8e77ba48b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."workflows_entity_type_enum" RENAME TO "workflows_entity_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."workflows_entity_type_enum" AS ENUM('leave', 'requisition', 'travel_request', 'travel_settlement', 'expense_claim', 'regularization', 'asset_assignment')`);
        await queryRunner.query(`ALTER TABLE "workflows" ALTER COLUMN "entity_type" TYPE "public"."workflows_entity_type_enum" USING "entity_type"::"text"::"public"."workflows_entity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."workflows_entity_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."approvals_entity_type_enum" RENAME TO "approvals_entity_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."approvals_entity_type_enum" AS ENUM('leave', 'requisition', 'travel_request', 'travel_settlement', 'expense_claim', 'regularization', 'asset_assignment')`);
        await queryRunner.query(`ALTER TABLE "approvals" ALTER COLUMN "entity_type" TYPE "public"."approvals_entity_type_enum" USING "entity_type"::"text"::"public"."approvals_entity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."approvals_entity_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."request_change_logs_entity_type_enum" RENAME TO "request_change_logs_entity_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."request_change_logs_entity_type_enum" AS ENUM('travel_request', 'expense_claim', 'asset_unit')`);
        await queryRunner.query(`ALTER TABLE "request_change_logs" ALTER COLUMN "entity_type" TYPE "public"."request_change_logs_entity_type_enum" USING "entity_type"::"text"::"public"."request_change_logs_entity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."request_change_logs_entity_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('approval_requested', 'approval_approved', 'approval_rejected', 'leave_approved', 'leave_rejected', 'expense_reimbursed', 'travel_reimbursed', 'asset_assigned', 'asset_low_stock', 'asset_warranty_expiring', 'system')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."attachments_owner_type_enum" RENAME TO "attachments_owner_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."attachments_owner_type_enum" AS ENUM('travel_request_item', 'expense_item', 'asset_unit', 'asset_purchase')`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "owner_type" TYPE "public"."attachments_owner_type_enum" USING "owner_type"::"text"::"public"."attachments_owner_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."attachments_owner_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "asset_locations" ADD CONSTRAINT "FK_aa6a63c4bf521e626171d727444" FOREIGN KEY ("parent_id") REFERENCES "asset_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_units" ADD CONSTRAINT "FK_973a3a31a0ca8eb992c72f297f2" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_units" ADD CONSTRAINT "FK_c4c1bdae97f1f9333441823a924" FOREIGN KEY ("condition_id") REFERENCES "asset_conditions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_units" ADD CONSTRAINT "FK_138480e3e899d2b281e34288764" FOREIGN KEY ("current_employee_id") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_units" ADD CONSTRAINT "FK_0172ebc655823c384309ad1c187" FOREIGN KEY ("current_department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_units" ADD CONSTRAINT "FK_d13b07b0b68dc66333edbddf33a" FOREIGN KEY ("current_location_id") REFERENCES "asset_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_stock" ADD CONSTRAINT "FK_3cf1e2a4c9240144d2893937323" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_stock" ADD CONSTRAINT "FK_aa78c93616235009874bff0078f" FOREIGN KEY ("location_id") REFERENCES "asset_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_purchase_items" ADD CONSTRAINT "FK_f6e69ba9cb83592bedf995d2059" FOREIGN KEY ("purchase_id") REFERENCES "asset_purchases"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_purchase_items" ADD CONSTRAINT "FK_d08872ace35a7a19ceb2a616cb5" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_purchase_items" ADD CONSTRAINT "FK_9ef99db35873a92c6b7402f530c" FOREIGN KEY ("location_id") REFERENCES "asset_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_purchases" ADD CONSTRAINT "FK_fc74a75dc818dbf6a8adea64287" FOREIGN KEY ("linked_requisition_id") REFERENCES "requisitions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_purchases" ADD CONSTRAINT "FK_03d52c2cafda727d73d3c26f089" FOREIGN KEY ("received_by") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_movements" ADD CONSTRAINT "FK_f934729ee62a46ded91e60bd136" FOREIGN KEY ("unit_id") REFERENCES "asset_units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_movements" ADD CONSTRAINT "FK_ae5a2e2ce3b172b38492081fd0b" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_movements" ADD CONSTRAINT "FK_1a921ed7a63c0b2fb3a2120a1e4" FOREIGN KEY ("performed_by") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "FK_fc1595e12c6ab7a198301f9d31a" FOREIGN KEY ("unit_id") REFERENCES "asset_units"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "asset_maintenance_records" ADD CONSTRAINT "FK_f0da2241689f7964145dbf58b64" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "asset_maintenance_records" DROP CONSTRAINT "FK_f0da2241689f7964145dbf58b64"`);
        await queryRunner.query(`ALTER TABLE "asset_maintenance_records" DROP CONSTRAINT "FK_fc1595e12c6ab7a198301f9d31a"`);
        await queryRunner.query(`ALTER TABLE "asset_movements" DROP CONSTRAINT "FK_1a921ed7a63c0b2fb3a2120a1e4"`);
        await queryRunner.query(`ALTER TABLE "asset_movements" DROP CONSTRAINT "FK_ae5a2e2ce3b172b38492081fd0b"`);
        await queryRunner.query(`ALTER TABLE "asset_movements" DROP CONSTRAINT "FK_f934729ee62a46ded91e60bd136"`);
        await queryRunner.query(`ALTER TABLE "asset_purchases" DROP CONSTRAINT "FK_03d52c2cafda727d73d3c26f089"`);
        await queryRunner.query(`ALTER TABLE "asset_purchases" DROP CONSTRAINT "FK_fc74a75dc818dbf6a8adea64287"`);
        await queryRunner.query(`ALTER TABLE "asset_purchase_items" DROP CONSTRAINT "FK_9ef99db35873a92c6b7402f530c"`);
        await queryRunner.query(`ALTER TABLE "asset_purchase_items" DROP CONSTRAINT "FK_d08872ace35a7a19ceb2a616cb5"`);
        await queryRunner.query(`ALTER TABLE "asset_purchase_items" DROP CONSTRAINT "FK_f6e69ba9cb83592bedf995d2059"`);
        await queryRunner.query(`ALTER TABLE "asset_stock" DROP CONSTRAINT "FK_aa78c93616235009874bff0078f"`);
        await queryRunner.query(`ALTER TABLE "asset_stock" DROP CONSTRAINT "FK_3cf1e2a4c9240144d2893937323"`);
        await queryRunner.query(`ALTER TABLE "asset_units" DROP CONSTRAINT "FK_d13b07b0b68dc66333edbddf33a"`);
        await queryRunner.query(`ALTER TABLE "asset_units" DROP CONSTRAINT "FK_0172ebc655823c384309ad1c187"`);
        await queryRunner.query(`ALTER TABLE "asset_units" DROP CONSTRAINT "FK_138480e3e899d2b281e34288764"`);
        await queryRunner.query(`ALTER TABLE "asset_units" DROP CONSTRAINT "FK_c4c1bdae97f1f9333441823a924"`);
        await queryRunner.query(`ALTER TABLE "asset_units" DROP CONSTRAINT "FK_973a3a31a0ca8eb992c72f297f2"`);
        await queryRunner.query(`ALTER TABLE "asset_locations" DROP CONSTRAINT "FK_aa6a63c4bf521e626171d727444"`);
        await queryRunner.query(`CREATE TYPE "public"."attachments_owner_type_enum_old" AS ENUM('travel_request_item', 'expense_item')`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "owner_type" TYPE "public"."attachments_owner_type_enum_old" USING "owner_type"::"text"::"public"."attachments_owner_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."attachments_owner_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."attachments_owner_type_enum_old" RENAME TO "attachments_owner_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('approval_requested', 'approval_approved', 'approval_rejected', 'leave_approved', 'leave_rejected', 'expense_reimbursed', 'travel_reimbursed', 'system')`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."request_change_logs_entity_type_enum_old" AS ENUM('travel_request', 'expense_claim')`);
        await queryRunner.query(`ALTER TABLE "request_change_logs" ALTER COLUMN "entity_type" TYPE "public"."request_change_logs_entity_type_enum_old" USING "entity_type"::"text"::"public"."request_change_logs_entity_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."request_change_logs_entity_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."request_change_logs_entity_type_enum_old" RENAME TO "request_change_logs_entity_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."approvals_entity_type_enum_old" AS ENUM('leave', 'requisition', 'travel_request', 'travel_settlement', 'expense_claim', 'regularization')`);
        await queryRunner.query(`ALTER TABLE "approvals" ALTER COLUMN "entity_type" TYPE "public"."approvals_entity_type_enum_old" USING "entity_type"::"text"::"public"."approvals_entity_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."approvals_entity_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."approvals_entity_type_enum_old" RENAME TO "approvals_entity_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."workflows_entity_type_enum_old" AS ENUM('leave', 'requisition', 'travel_request', 'travel_settlement', 'expense_claim', 'regularization')`);
        await queryRunner.query(`ALTER TABLE "workflows" ALTER COLUMN "entity_type" TYPE "public"."workflows_entity_type_enum_old" USING "entity_type"::"text"::"public"."workflows_entity_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."workflows_entity_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."workflows_entity_type_enum_old" RENAME TO "workflows_entity_type_enum"`);
        await queryRunner.query(`DROP TABLE "asset_maintenance_records"`);
        await queryRunner.query(`DROP TYPE "public"."asset_maintenance_records_outcome_enum"`);
        await queryRunner.query(`DROP TABLE "asset_movements"`);
        await queryRunner.query(`DROP TYPE "public"."asset_movements_to_holder_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."asset_movements_from_holder_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."asset_movements_movement_type_enum"`);
        await queryRunner.query(`DROP TABLE "asset_purchases"`);
        await queryRunner.query(`DROP TYPE "public"."asset_purchases_status_enum"`);
        await queryRunner.query(`DROP TABLE "asset_purchase_items"`);
        await queryRunner.query(`DROP TABLE "asset_stock"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c8c7819a908c61687755f3662b"`);
        await queryRunner.query(`DROP TABLE "asset_units"`);
        await queryRunner.query(`DROP TYPE "public"."asset_units_current_holder_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."asset_units_status_enum"`);
        await queryRunner.query(`DROP TABLE "asset_locations"`);
        await queryRunner.query(`DROP TABLE "asset_conditions"`);
        await queryRunner.query(`DROP TABLE "asset_categories"`);
        await queryRunner.query(`DROP TYPE "public"."asset_categories_depreciation_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."asset_categories_tracking_mode_enum"`);
    }

}
