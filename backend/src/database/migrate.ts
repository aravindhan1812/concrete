/**
 * Minimal, dependency-free SQL migration runner.
 *
 *   npm run migrate            apply pending migrations
 *   npm run migrate -- status  list applied / pending
 *
 * Layout (repo root):
 *   database/schema.sql            baseline schema  (version 0000)
 *   database/seed.sql              baseline seed    (version 0000)
 *   database/migrations/NNNN_name.sql   additive changes, applied in filename order
 *
 * Rules:
 *   - A migration file is never edited after it is merged; write a new one.
 *   - Each file runs inside one transaction and is recorded in schema_migrations.
 *   - A database that already carries the baseline (e.g. created by the Postgres
 *     Docker image from schema.sql + seed.sql) is detected and marked as 0000.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';

const BASELINE = '0000';

function databaseDir(): string {
  // Works from src (ts-node) and from dist (compiled): both are two levels under backend/.
  const candidates = [resolve(__dirname, '../../../database'), resolve(process.cwd(), '../database'), resolve(process.cwd(), 'database')];
  for (const dir of candidates) {
    try {
      readdirSync(dir);
      return dir;
    } catch {
      /* try next */
    }
  }
  throw new Error(`database/ directory not found (looked in ${candidates.join(', ')})`);
}

interface MigrationFile {
  version: string;
  name: string;
  path: string;
}

function listMigrations(dir: string): MigrationFile[] {
  let files: string[] = [];
  try {
    files = readdirSync(join(dir, 'migrations')).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f));
  } catch {
    return [];
  }
  return files
    .sort()
    .map((f) => ({ version: f.slice(0, 4), name: f.slice(5, -4), path: join(dir, 'migrations', f) }));
}

async function ensureTable(db: Client) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

async function applied(db: Client): Promise<Set<string>> {
  const res = await db.query<{ version: string }>('SELECT version FROM schema_migrations');
  return new Set(res.rows.map((r) => r.version));
}

async function runFile(db: Client, version: string, name: string, sql: string) {
  await db.query('BEGIN');
  try {
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [version, name]);
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

export async function migrate(databaseUrl: string, mode: 'apply' | 'status' = 'apply', log: (msg: string) => void = console.log) {
  const dir = databaseDir();
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await ensureTable(db);
    const done = await applied(db);

    // Baseline: fresh database → run schema + seed; pre-initialised database → just record it.
    if (!done.has(BASELINE)) {
      const hasBaseline = await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'companies'");
      if (hasBaseline.rowCount) {
        if (mode === 'apply') {
          await db.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [BASELINE, 'baseline (pre-existing)']);
          log('0000  baseline                    already present, recorded');
        } else log('0000  baseline                    present (unrecorded)');
      } else if (mode === 'apply') {
        const sql = readFileSync(join(dir, 'schema.sql'), 'utf8') + '\n' + readFileSync(join(dir, 'seed.sql'), 'utf8');
        await runFile(db, BASELINE, 'baseline', sql);
        log('0000  baseline                    applied (schema.sql + seed.sql)');
      } else log('0000  baseline                    pending');
      done.add(BASELINE);
    } else if (mode === 'status') log('0000  baseline                    applied');

    let pending = 0;
    for (const m of listMigrations(dir)) {
      if (done.has(m.version)) {
        if (mode === 'status') log(`${m.version}  ${m.name.padEnd(28)}applied`);
        continue;
      }
      pending++;
      if (mode === 'status') {
        log(`${m.version}  ${m.name.padEnd(28)}pending`);
        continue;
      }
      await runFile(db, m.version, m.name, readFileSync(m.path, 'utf8'));
      log(`${m.version}  ${m.name.padEnd(28)}applied`);
    }
    if (mode === 'apply' && pending === 0) log('No pending migrations.');
    return pending;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const mode = process.argv[2] === 'status' ? 'status' : 'apply';
  migrate(url, mode).catch((err) => {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
