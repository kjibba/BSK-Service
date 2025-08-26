import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeFields1724660000000 implements MigrationInterface {
  name = 'AddEmployeeFields1724660000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN phone varchar(30) NULL`);
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN title varchar(100) NULL`);
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN active tinyint(1) NOT NULL DEFAULT 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN active`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN title`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN phone`);
  }
}
