import { MigrationInterface, QueryRunner } from 'typeorm';
import { PasswordService } from '../../../auth/password.service';

export class SeedAdmin1792755514301 implements MigrationInterface {
  name = 'SeedAdmin1792755514301';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'Defina ADMIN_EMAIL e ADMIN_PASSWORD para criar o primeiro administrador.',
      );
    }

    const passwordHash = await new PasswordService().hash(password);

    await queryRunner.query(
      `INSERT INTO "user" ("name", "email", "password", "roles")
       VALUES ($1, $2, $3, ARRAY['admin']::"public"."user_roles_enum"[])
       ON CONFLICT ("email") DO NOTHING`,
      ['Administrador', email, passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "user" WHERE "email" = $1`, [
      process.env.ADMIN_EMAIL,
    ]);
  }
}
