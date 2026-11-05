#!/usr/bin/env node
/**
 * Apply `supabase/migrations/*.sql` to a Postgres database, in filename order,
 * once each.
 *
 *   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres' \
 *     pnpm db:migrate
 *
 * Migrations are forward-only: this never edits or removes a file that has
 * already run. Applied versions are recorded in
 * `supabase_migrations.schema_migrations`, the same table the Supabase CLI
 * uses, so the two agree about what has run.
 *
 * The URL is read from the environment and is never written to disk or to a
 * file in the repository. Use the **session pooler** connection string from the
 * Supabase dashboard (Project settings → Database → Connection string): direct
 * connections are IPv6-only and a password is required either way.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error(
    [
      'SUPABASE_DB_URL is not set.',
      '',
      'Applying migrations needs a Postgres connection string, which is a different',
      'secret from the API keys:',
      '',
      '  Supabase dashboard → Project settings → Database → Connection string',
      '  → "Session pooler" → copy, and put your database password in it.',
      '',
      'Then:',
      '',
      "  SUPABASE_DB_URL='postgresql://...' pnpm db:migrate",
      '',
      'Without it, the migrations can also be pasted into the Supabase SQL editor',
      'in filename order — see "Database" in README.md.',
    ].join('\n'),
  );
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query('create schema if not exists supabase_migrations');
  await client.query(`
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();

  const { rows } = await client.query('select version from supabase_migrations.schema_migrations');
  const applied = new Set(rows.map((row) => row.version));

  let ran = 0;
  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) {
      console.log(`skip    ${file}`);
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Each migration runs in its own transaction: a failure leaves the database
    // exactly as it was before that file started.
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)',
        [version, file],
      );
      await client.query('commit');
      console.log(`applied ${file}`);
      ran += 1;
    } catch (error) {
      await client.query('rollback');
      console.error(`FAILED  ${file}`);
      console.error(error instanceof Error ? error.message : error);
      await client.end();
      process.exit(1);
    }
  }

  console.log(ran === 0 ? 'Nothing to do — already up to date.' : `Applied ${ran} migration(s).`);
  await client.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
