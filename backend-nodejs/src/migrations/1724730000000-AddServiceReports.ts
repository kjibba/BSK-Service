import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class AddServiceReports1724730000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "service_reports",
        columns: [
          { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "visit_id", type: "int", isNullable: false },
          { name: "customer_id", type: "int", isNullable: false },
          { name: "file_path", type: "varchar", length: "500", isNullable: false },
          { name: "created_at", type: "datetime", default: "CURRENT_TIMESTAMP" },
        ],
      })
    );

    await queryRunner.createIndex(
      "service_reports",
      new TableIndex({ name: "IDX_service_reports_visit_id", columnNames: ["visit_id"] })
    );
    await queryRunner.createIndex(
      "service_reports",
      new TableIndex({ name: "IDX_service_reports_customer_id", columnNames: ["customer_id"] })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("service_reports", "IDX_service_reports_visit_id");
    await queryRunner.dropIndex("service_reports", "IDX_service_reports_customer_id");
    await queryRunner.dropTable("service_reports");
  }
}
