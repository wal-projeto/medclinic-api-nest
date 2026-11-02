import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1793642303968 implements MigrationInterface {
  name = 'Migration1793642303968';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "doctor" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "crm" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" integer NOT NULL, CONSTRAINT "uq_doctor_crm" UNIQUE ("crm"), CONSTRAINT "rel_doctor_user_id" UNIQUE ("user_id"), CONSTRAINT "pk_doctor" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor" ADD CONSTRAINT "fk_doctor_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctor" DROP CONSTRAINT "fk_doctor_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "doctor"`);
  }
}
