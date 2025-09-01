import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class ModelExtensions1725230000000 implements MigrationInterface {
  name = 'ModelExtensions1725230000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Customer additions
    await queryRunner.addColumns('customers', [
      new TableColumn({ name: 'org_number', type: 'varchar', length: '20', isNullable: true }),
      new TableColumn({ name: 'created_at', type: 'datetime', isNullable: true }),
    ]);

    // Visit additions
    await queryRunner.addColumns('visits', [
      new TableColumn({ name: 'customer_signature_url', type: 'varchar', length: '500', isNullable: true }),
      new TableColumn({ name: 'technician_signature_url', type: 'varchar', length: '500', isNullable: true }),
    ]);

    // MaterialUsage additions
    await queryRunner.addColumns('material_usage', [
      new TableColumn({ name: 'unit', type: 'varchar', length: '20', isNullable: true }),
      new TableColumn({ name: 'batch_number', type: 'varchar', length: '50', isNullable: true }),
      new TableColumn({ name: 'risk_assessment', type: 'text', isNullable: true }),
      new TableColumn({ name: 'approved_by', type: 'int', isNullable: true }),
      new TableColumn({ name: 'waste_handling', type: 'text', isNullable: true }),
    ]);

    // Indexes (lightweight)
    await queryRunner.query("CREATE INDEX IF NOT EXISTS IDX_customers_org ON customers(org_number)");
    await queryRunner.query("CREATE INDEX IF NOT EXISTS IDX_visits_customer_signature ON visits(customer_signature_url(100))");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order
    await queryRunner.dropIndex('visits', 'IDX_visits_customer_signature').catch(()=>{});
    await queryRunner.dropIndex('customers', 'IDX_customers_org').catch(()=>{});

    await queryRunner.dropColumns('material_usage', ['unit','batch_number','risk_assessment','approved_by','waste_handling']);
    await queryRunner.dropColumns('visits', ['customer_signature_url','technician_signature_url']);
    await queryRunner.dropColumns('customers', ['org_number','created_at']);
  }
}
