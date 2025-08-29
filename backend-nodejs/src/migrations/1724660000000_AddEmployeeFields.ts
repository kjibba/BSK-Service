import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeFields1724660000000 implements MigrationInterface {
  name = 'AddEmployeeFields1724660000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: sjekk kolonne-eksistens før ALTER
    if (!(await queryRunner.hasColumn('employees', 'phone'))) {
      await queryRunner.query(`ALTER TABLE employees ADD COLUMN phone varchar(30) NULL`);
    }
    if (!(await queryRunner.hasColumn('employees', 'title'))) {
      await queryRunner.query(`ALTER TABLE employees ADD COLUMN title varchar(100) NULL`);
    }
    if (!(await queryRunner.hasColumn('employees', 'active'))) {
      await queryRunner.query(`ALTER TABLE employees ADD COLUMN active tinyint(1) NOT NULL DEFAULT 1`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('employees', 'active')) {
      await queryRunner.query(`ALTER TABLE employees DROP COLUMN active`);
    }
    if (await queryRunner.hasColumn('employees', 'title')) {
      await queryRunner.query(`ALTER TABLE employees DROP COLUMN title`);
    }
    if (await queryRunner.hasColumn('employees', 'phone')) {
      await queryRunner.query(`ALTER TABLE employees DROP COLUMN phone`);
    }
  }
}
