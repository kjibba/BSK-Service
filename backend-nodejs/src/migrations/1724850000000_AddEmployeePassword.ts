import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeePassword1724850000000 implements MigrationInterface {
  name = 'AddEmployeePassword1724850000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('employees', 'password_hash'))) {
      await queryRunner.query(`ALTER TABLE employees ADD COLUMN password_hash varchar(255) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('employees', 'password_hash')) {
      await queryRunner.query(`ALTER TABLE employees DROP COLUMN password_hash`);
    }
  }
}
