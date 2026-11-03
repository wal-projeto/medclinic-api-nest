import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1793737976184 implements MigrationInterface {
  name = 'Migration1793737976184';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'in_progress', 'done', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "appointment" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "doctor_id" integer NOT NULL, "patient_id" integer NOT NULL, "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."appointment_status" NOT NULL DEFAULT 'scheduled', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "ck_appointment_starts_at_ends_at" CHECK ("starts_at" < "ends_at"), CONSTRAINT "pk_appointment" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_appointment_patient_id_starts_at" ON "appointment"  ("patient_id", "starts_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_appointment_doctor_id_starts_at" ON "appointment"  ("doctor_id", "starts_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "appointment" ADD CONSTRAINT "fk_appointment_doctor_id" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointment" ADD CONSTRAINT "fk_appointment_patient_id" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointment" DROP CONSTRAINT "fk_appointment_patient_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointment" DROP CONSTRAINT "fk_appointment_doctor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_appointment_doctor_id_starts_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_appointment_patient_id_starts_at"`,
    );
    await queryRunner.query(`DROP TABLE "appointment"`);
    await queryRunner.query(`DROP TYPE "public"."appointment_status"`);
  }
}
