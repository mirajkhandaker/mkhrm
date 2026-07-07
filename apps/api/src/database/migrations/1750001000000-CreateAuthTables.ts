import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1750001000000 implements MigrationInterface {
  name = 'CreateAuthTables1750001000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "user_status" AS ENUM ('active', 'inactive', 'suspended')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
        "email"         varchar       NOT NULL,
        "password_hash" varchar       NOT NULL,
        "status"        "user_status" NOT NULL DEFAULT 'active',
        "last_login_at" timestamptz,
        "created_at"    timestamptz   NOT NULL DEFAULT now(),
        "updated_at"    timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id"          uuid    NOT NULL DEFAULT gen_random_uuid(),
        "name"        varchar NOT NULL,
        "description" text,
        CONSTRAINT "PK_roles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_roles_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id"          uuid    NOT NULL DEFAULT gen_random_uuid(),
        "key"         varchar NOT NULL,
        "description" text,
        CONSTRAINT "PK_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permissions_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id"       uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_rp_role" FOREIGN KEY ("role_id")       REFERENCES "roles"("id")       ON DELETE CASCADE,
        CONSTRAINT "FK_rp_perm" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("user_id", "role_id"),
        CONSTRAINT "FK_ur_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ur_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_user_roles_user_id"        ON "user_roles"        ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_role_id"        ON "user_roles"        ("role_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_role_permissions_role_id"  ON "role_permissions"  ("role_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_status"`);
  }
}
