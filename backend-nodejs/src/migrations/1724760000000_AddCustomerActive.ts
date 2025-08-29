import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerActive1724760000000 implements MigrationInterface {
  name = 'AddCustomerActive1724760000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`);
  await queryRunner.query(`UPDATE customers SET active = 1 WHERE active IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS active`);
  }
}
