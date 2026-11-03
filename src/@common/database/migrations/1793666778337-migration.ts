import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1793666778337 implements MigrationInterface {
  name = 'Migration1793666778337';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "work_shift" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "doctor_id" integer NOT NULL, "week_day" smallint NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "slot_duration_minutes" integer NOT NULL, CONSTRAINT "ck_work_shift_slot_duration_minutes_between_1_and_1440" CHECK ("slot_duration_minutes" BETWEEN 1 AND 1440), CONSTRAINT "ck_work_shift_start_time_end_time" CHECK ("start_time" < "end_time"), CONSTRAINT "ck_work_shift_week_day_between_0_and_6" CHECK ("week_day" BETWEEN 0 AND 6), CONSTRAINT "pk_work_shift" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_shift" ADD CONSTRAINT "fk_work_shift_doctor_id" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_shift" DROP CONSTRAINT "fk_work_shift_doctor_id"`,
    );
    await queryRunner.query(`DROP TABLE "work_shift"`);
  }
}
