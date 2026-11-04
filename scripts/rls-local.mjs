#!/usr/bin/env node
/**
 * Run the Row Level Security suite against a throwaway local Postgres.
 *
 *   pnpm test:rls:local
 *
 * Creates a scratch database, applies the Supabase stub (auth schema,
 * `auth.uid()`, the anon/authenticated roles), then every migration in
 * `supabase/migrations/` in order, then `supabase/tests/local/rls.test.sql`.
 * The database is dropped afterwards, so nothing survives a run.
 *
 * This is the pre-flight check: it proves the policies before anything is
 * applied to a hosted project. The hosted suite (`pnpm test:rls`) is the one
 * that counts for release.
 *
 * Environment:
 *   RLS_LOCAL_ADMIN_URL  Postgres URL with CREATEDB rights, for a server that
 *                        allows password/trust logins. Defaults to
 *                        postgres://postgres@localhost:5432/postgres
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const STUB = path.join(ROOT, 'supabase', 'tests', 'local', '00_supabase_stub.sql');
const TEST_FILE = path.join(ROOT, 'supabase', 'tests', 'local', 'rls.test.sql');
const SCRATCH_DB = 'tendshare_rls_scratch';

const ADMIN_URL = process.env.RLS_LOCAL_ADMIN_URL ?? 'postgres://postgres@localhost:5432/postgres';

function scratchUrl(adminUrl) {
  const url = new URL(adminUrl);
  url.pathname = `/${SCRATCH_DB}`;
  return url.toString();
}

async function applyFile(client, file, label) {
  const sql = await readFile(file, 'utf8');
  try {
    await client.query(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} failed: ${message}`, { cause: error });
  }
}

async function main() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();

  await admin.query(`drop database if exists ${SCRATCH_DB}`);
  await admin.query(`create database ${SCRATCH_DB}`);

  const client = new Client({ connectionString: scratchUrl(ADMIN_URL) });
  await client.connect();

  let failure = null;
  try {
    await applyFile(client, STUB, 'the Supabase stub');

    const migrations = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const name of migrations) {
      await applyFile(client, path.join(MIGRATIONS_DIR, name), `migration ${name}`);
    }
    console.log(`Applied ${migrations.length} migrations.`);

    try {
      await applyFile(client, TEST_FILE, 'the RLS suite');
    } catch (error) {
      failure = error;
    }

    if (failure) {
      console.log(failure.message);
    }

    const { rows } = await client
      .query(`select n, name, ok, detail from tests.results order by n`)
      .catch(() => ({ rows: [] }));

    let failed = 0;
    for (const row of rows) {
      const label = row.ok ? 'PASS' : 'FAIL';
      const detail = row.detail ? `   (${row.detail})` : '';
      console.log(`${label}  ${row.name}${detail}`);
      if (!row.ok) failed += 1;
    }

    console.log('');
    console.log(
      `RLS checks: ${rows.length - failed} passed, ${failed} failed, ${rows.length} total`,
    );

    await client.end();
    await admin.query(`drop database if exists ${SCRATCH_DB} with (force)`);
    await admin.end();

    process.exit(failed > 0 || failure ? 1 : 0);
  } catch (error) {
    try {
      await client.end();
    } catch {
      /* already closed */
    }
    try {
      await admin.query(`drop database if exists ${SCRATCH_DB} with (force)`);
      await admin.end();
    } catch {
      /* already closed */
    }
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
