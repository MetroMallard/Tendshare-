import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  PROFILE_AUDIT_ENUMS,
  PROFILE_AUDIT_FIELDS,
  PROFILE_AUDIT_TABLES,
  auditSummaryFor,
  isFieldNameOnly,
} from './profileAudit';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const PROFILE_MIGRATION = readFileSync(
  path.join(ROOT, 'supabase/migrations/20261106120000_care_recipient_profile.sql'),
  'utf8',
);
const IDENTITY_MIGRATION = readFileSync(
  path.join(ROOT, 'supabase/migrations/20261104120100_identity_tables.sql'),
  'utf8',
);

/** The column names inside `create table public.<name> ( … );`. */
function columnsOf(table: string): readonly string[] {
  const start = PROFILE_MIGRATION.indexOf(`create table public.${table} (`);

  if (start === -1) {
    return [];
  }

  const end = PROFILE_MIGRATION.indexOf('\n);', start);
  const block = PROFILE_MIGRATION.slice(start, end);

  return block
    .split('\n')
    .map((line) => /^\s{2}([a-z][a-z0-9_]*)\s/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
}

describe('the audit vocabulary', () => {
  it('is a list of column names, not prose', () => {
    for (const table of PROFILE_AUDIT_TABLES) {
      for (const field of PROFILE_AUDIT_FIELDS[table]) {
        expect(field, `${table}.${field} must be a column name`).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(field).not.toContain(' ');
        expect(field.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('only names columns that exist in the migration', () => {
    for (const table of PROFILE_AUDIT_TABLES) {
      const columns =
        table === 'care_recipients'
          ? // The basics table predates this migration: its columns come from
            // Task 3 plus the three added here.
            [...columnsFrom(IDENTITY_MIGRATION, table), ...addedColumnsOf(table)]
          : columnsOf(table);

      expect(columns.length, `${table} should have columns`).toBeGreaterThan(3);

      for (const field of PROFILE_AUDIT_FIELDS[table]) {
        expect(columns, `${table}.${field} is not a column`).toContain(field);
      }
    }
  });

  it('never names a column that is bookkeeping', () => {
    const bookkeeping = [
      'id',
      'circle_id',
      'care_recipient_id',
      'created_by',
      'created_at',
      'updated_at',
    ];

    for (const table of PROFILE_AUDIT_TABLES) {
      for (const field of PROFILE_AUDIT_FIELDS[table]) {
        expect(bookkeeping, `${table}.${field} is bookkeeping`).not.toContain(field);
      }
    }
  });
});

describe('the summary shape', () => {
  it('sorts the field names, so the same edit always looks the same', () => {
    expect(auditSummaryFor(['phone', 'name'])).toEqual({ fields: ['name', 'phone'] });
  });

  it('drops duplicates', () => {
    expect(auditSummaryFor(['phone', 'phone'])).toEqual({ fields: ['phone'] });
  });

  it('carries the kind enum when the row has one', () => {
    expect(auditSummaryFor(['label'], 'allergy')).toEqual({ fields: ['label'], kind: 'allergy' });
  });

  it('is empty for an event with no fields', () => {
    expect(auditSummaryFor([])).toEqual({ fields: [] });
  });
});

describe('the guard that keeps values out of the log', () => {
  it('accepts field names and enums', () => {
    expect(isFieldNameOnly({ fields: ['name', 'phone'] })).toBe(true);
    expect(isFieldNameOnly({ fields: ['label'], kind: 'allergy' })).toBe(true);
    expect(isFieldNameOnly({})).toBe(true);
  });

  it('refuses a value hiding in the payload', () => {
    // The three ways a well-meaning caller would leak health data.
    expect(isFieldNameOnly({ fields: ['Penicillin'] })).toBe(false);
    expect(isFieldNameOnly({ fields: ['label'], kind: 'Penicillin' })).toBe(false);
    expect(isFieldNameOnly({ fields: ['label'], value: 'Penicillin' })).toBe(false);
    expect(isFieldNameOnly({ name: 'Margaret' })).toBe(false);
  });

  it('refuses a field that is not a column name', () => {
    expect(isFieldNameOnly({ fields: ['Dr Patel'] })).toBe(false);
    expect(isFieldNameOnly({ fields: ['phone; drop table'] })).toBe(false);
  });

  it('knows every enum the triggers can emit', () => {
    for (const value of ['allergy', 'condition', 'doctor', 'pharmacy', 'other']) {
      expect(PROFILE_AUDIT_ENUMS).toContain(value);
    }
  });
});

/** Column names from any migration file's `create table public.<table> ( … )`. */
function columnsFrom(sql: string, table: string): readonly string[] {
  const start = sql.indexOf(`create table public.${table} (`);

  if (start === -1) {
    return [];
  }

  const end = sql.indexOf('\n);', start);

  return sql
    .slice(start, end)
    .split('\n')
    .map((line) => /^\s{2}([a-z][a-z0-9_]*)\s/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
}

/** Columns added to `care_recipients` by this migration's `alter table`. */
function addedColumnsOf(table: string): readonly string[] {
  const start = PROFILE_MIGRATION.indexOf(`alter table public.${table}`);

  if (start === -1) {
    return [];
  }

  const block = PROFILE_MIGRATION.slice(start, PROFILE_MIGRATION.indexOf(';', start));

  return [...block.matchAll(/add column ([a-z][a-z0-9_]*)/g)].map((match) => match[1]!);
}
