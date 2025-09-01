import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class AddClientLogs1724960000000 implements MigrationInterface {
  name = 'AddClientLogs1724960000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasTable('client_logs');
    if (!has) {
      await queryRunner.createTable(new Table({
        name: 'client_logs',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'level', type: 'varchar', length: '20', default: "'error'" },
          { name: 'message', type: 'text' },
          { name: 'stack', type: 'mediumtext', isNullable: true },
          { name: 'url', type: 'varchar', length: '1024', isNullable: true },
          { name: 'route', type: 'varchar', length: '255', isNullable: true },
          { name: 'user_agent', type: 'varchar', length: '512', isNullable: true },
          { name: 'user_id', type: 'int', isNullable: true },
          { name: 'meta_json', type: 'mediumtext', isNullable: true },
        ],
        indices: [
          { columnNames: ['level'] },
          { columnNames: ['user_id'] },
          { columnNames: ['created_at'] },
        ]
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasTable('client_logs');
    if (has) await queryRunner.dropTable('client_logs');
  }
}
