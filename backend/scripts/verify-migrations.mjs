import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { loadMigrations, runMigrations, validateMigrationSequence } from './migrate.mjs';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

const { Client } = pg;
const baseDatabaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/delivery_risk_dev';

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function makeDatabaseUrl(databaseName) {
  const url = new URL(baseDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function assertSchema(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const expectedTables = [
      'business_configuration_versions',
      'report_runs',
      'run_configuration_snapshots',
      'project_snapshots',
      'sprint_snapshots',
      'issue_snapshots',
      'issue_sprint_memberships',
      'issue_links',
      'findings',
      'finding_signals',
      'risk_summaries',
      'risk_summary_counts',
      'publication_attempts',
      'workflow_artifact_attempts',
      'audit_events',
    ];
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const tableNames = new Set(tables.rows.map((row) => row.table_name));
    for (const table of expectedTables) {
      assert(tableNames.has(table), `Expected table ${table} to exist`);
    }

    const uniqueness = await client.query(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conname IN ('findings_identity_uq', 'risk_summaries_identity_uq')`,
    );
    assert.equal(uniqueness.rows.length, 2);
    assert(
      uniqueness.rows.every((row) => row.definition.includes('NULLS NOT DISTINCT')),
      'Nullable unique identities must use PostgreSQL 15 NULLS NOT DISTINCT',
    );

    const activeScopeIndex = await client.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'report_runs_active_scope_period_uidx'`,
    );
    assert.equal(activeScopeIndex.rows.length, 1);
    assert.match(activeScopeIndex.rows[0].indexdef, /WHERE \(status = ANY/);

    const migrationRows = await client.query('SELECT version, name FROM schema_migrations ORDER BY version');
    assert.equal(migrationRows.rows.length, 1);
    assert.equal(migrationRows.rows[0].version, 1);
    assert.equal(migrationRows.rows[0].name, 'initial_schema');
  } finally {
    await client.end();
  }
}

async function main() {
  const migrations = await loadMigrations();
  assert.equal(
    migrations.length,
    1,
    'Update migration lifecycle expectations when adding versions.',
  );
  assert.throws(
    () => validateMigrationSequence([{ version: 2, name: 'out_of_order' }]),
    /incomplete or out of order/,
  );

  const databaseName = `delivery_risk_migration_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const adminUrl = makeDatabaseUrl('postgres');
  const databaseUrl = makeDatabaseUrl(databaseName);
  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();

  try {
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    const initialStatus = await new Client({ connectionString: databaseUrl });
    await initialStatus.connect();
    try {
      const ledgerExists = await initialStatus.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
      assert.equal(ledgerExists.rows[0].exists, false);
    } finally {
      await initialStatus.end();
    }

    await runMigrations('up', databaseUrl);
    await assertSchema(databaseUrl);
    await runMigrations('up', databaseUrl);
    await assertSchema(databaseUrl);

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const applied = await client.query("SELECT checksum FROM schema_migrations WHERE version = 1");
      const originalChecksum = applied.rows[0].checksum;
      await client.query("UPDATE schema_migrations SET checksum = repeat('0', 64) WHERE version = 1");
      await assert.rejects(runMigrations('status', databaseUrl), /checksum differs/);
      await client.query('UPDATE schema_migrations SET checksum = $1 WHERE version = 1', [originalChecksum]);

      await client.query(
        "INSERT INTO schema_migrations (version, name, checksum) VALUES (2, 'unexpected', repeat('1', 64))",
      );
      await assert.rejects(runMigrations('status', databaseUrl), /unknown migration version/);
      await client.query('DELETE FROM schema_migrations WHERE version = 2');
    } finally {
      await client.end();
    }

    await runMigrations('down', databaseUrl);
    const rolledBackClient = new Client({ connectionString: databaseUrl });
    await rolledBackClient.connect();
    try {
      const domainTable = await rolledBackClient.query("SELECT to_regclass('public.report_runs') IS NOT NULL AS exists");
      const migrationCount = await rolledBackClient.query('SELECT count(*)::int AS count FROM schema_migrations');
      assert.equal(domainTable.rows[0].exists, false);
      assert.equal(migrationCount.rows[0].count, 0);
    } finally {
      await rolledBackClient.end();
    }

    await runMigrations('up', databaseUrl);
    await assertSchema(databaseUrl);
    console.log('Migration verification passed: clean apply, repeat apply, order/checksum rejection, rollback, and forward recovery.');
  } finally {
    await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
    await adminClient.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
