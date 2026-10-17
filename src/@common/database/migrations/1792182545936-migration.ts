import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1792182545936 implements MigrationInterface {
  name = 'Migration1792182545936';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_roles_enum" AS ENUM('admin', 'secretary', 'doctor')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" (
      "id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, 
      "name" character varying(255) NOT NULL, 
      "email" character varying(255) NOT NULL, 
      "password" character varying(255) NOT NULL, 
      "roles" "public"."user_roles_enum" array NOT NULL, 
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
      CONSTRAINT "uq_user_email" UNIQUE ("email"), 
      CONSTRAINT "pk_user" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TYPE "public"."user_roles_enum"`);
  }
}
