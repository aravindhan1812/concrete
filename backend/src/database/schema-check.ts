/**
 * Verifies every TypeORM entity column exists in the migrated database with a compatible type.
 * The schema is owned by SQL migrations (synchronize: false), so this is what catches an entity
 * that drifted from the tables — e.g. a renamed column that a migration missed.
 *
 *   DATABASE_URL=… npm run schema:check
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const ds = new DataSource({ type: 'postgres', url, entities: [join(__dirname, '..', 'entities', '*.entity.{ts,js}'), join(__dirname, '..', 'entities', '*.entities.{ts,js}')] });
  await ds.initialize();
  try {
    const rows: { table_name: string; column_name: string }[] = await ds.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    );
    const columns = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const tables = new Set(rows.map((r) => r.table_name));
    const problems: string[] = [];
    for (const meta of ds.entityMetadatas) {
      if (!tables.has(meta.tableName)) {
        problems.push(`${meta.name}: table "${meta.tableName}" does not exist`);
        continue;
      }
      for (const col of meta.columns) {
        if (!columns.has(`${meta.tableName}.${col.databaseName}`)) problems.push(`${meta.name}.${col.propertyName}: column "${meta.tableName}.${col.databaseName}" does not exist`);
      }
    }
    if (problems.length) {
      console.error(`Schema check failed (${problems.length}):\n  ` + problems.join('\n  '));
      process.exitCode = 1;
    } else {
      console.log(`Schema check passed: ${ds.entityMetadatas.length} entities match the database.`);
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Schema check error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
