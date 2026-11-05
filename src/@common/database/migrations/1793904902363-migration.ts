import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1793904902363 implements MigrationInterface {
  name = 'Migration1793904902363';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "medical_record" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "patient_id" integer NOT NULL, "doctor_id" integer NOT NULL, "text" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "ck_medical_record_length_btrim_text_0" CHECK (length(btrim("text")) > 0), CONSTRAINT "pk_medical_record" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_medical_record_created_at_patient_id" ON "medical_record"  ("patient_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "medical_record" ADD CONSTRAINT "fk_medical_record_patient_id" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "medical_record" ADD CONSTRAINT "fk_medical_record_doctor_id" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "medical_record" DROP CONSTRAINT "fk_medical_record_doctor_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "medical_record" DROP CONSTRAINT "fk_medical_record_patient_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_medical_record_created_at_patient_id"`,
    );
    await queryRunner.query(`DROP TABLE "medical_record"`);
  }
}
