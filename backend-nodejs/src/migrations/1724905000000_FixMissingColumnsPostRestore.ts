import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

// Defensive migration to heal restored DBs that may have a migrations record but are missing columns
export class FixMissingColumnsPostRestore1724905000000 implements MigrationInterface {
  name = 'FixMissingColumnsPostRestore1724905000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // customers.active (boolean default 1)
    const hasCustomerActive = await queryRunner.hasColumn('customers', 'active');
    if (!hasCustomerActive) {
      await queryRunner.addColumn(
        'customers',
        new TableColumn({
          name: 'active',
          type: 'tinyint',
          width: 1,
          isNullable: false,
          default: 1,
        })
      );
      await queryRunner.query(`UPDATE customers SET active = 1 WHERE active IS NULL`);
    }

    // employees.password_hash (nullable varchar)
    const hasPasswordHash = await queryRunner.hasColumn('employees', 'password_hash');
    if (!hasPasswordHash) {
      await queryRunner.addColumn(
        'employees',
        new TableColumn({
          name: 'password_hash',
          type: 'varchar',
          length: '255',
          isNullable: true,
          default: null,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive down: only drop columns if they exist.
    const hasCustomerActive = await queryRunner.hasColumn('customers', 'active');
    if (hasCustomerActive) {
      await queryRunner.dropColumn('customers', 'active');
    }
    const hasPasswordHash = await queryRunner.hasColumn('employees', 'password_hash');
    if (hasPasswordHash) {
      await queryRunner.dropColumn('employees', 'password_hash');
    }
  }
}
