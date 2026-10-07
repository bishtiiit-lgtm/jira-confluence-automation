import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

const { Client } = pg;
const defaultDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/delivery_risk_dev';
const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');
const migrationTable = 'schema_migrations';
const advisoryLockFirstKey = 1380270413;
const advisoryLockSecondKey = 1;
const migrationFilePattern = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;

function checksum(upSql, downSql) {
  return createHash('sha256').update(upSql).update('\0').update(downSql).digest('hex');
}

export async function loadMigrations(directory = migrationDirectory) {
  const fileNames = await readdir(directory);
  const entries = new Map();

  for (const fileName of fileNames) {
    const match = migrationFilePattern.exec(fileName);
    if (!match) {
      if (fileName.endsWith('.up.sql') || fileName.endsWith('.down.sql')) {
        throw new Error(`Invalid migration filename: ${fileName}`);
      }
      continue;
    }

    const [, versionText, name, direction] = match;
    const version = Number(versionText);
    const entry = entries.get(version) ?? { version, name };
    if (entry.name !== name || entry[direction]) {
      throw new Error(`Duplicate or mismatched migration files for version ${versionText}`);
    }
    entry[direction] = await readFile(resolve(directory, fileName), 'utf8');
    entries.set(version, entry);
  }

  const migrations = [...entries.values()].sort((left, right) => left.version - right.version);
  validateMigrationSequence(migrations);

  return migrations.map((migration) => {
    if (!migration.up || !migration.down) {
      throw new Error(`Migration ${String(migration.version).padStart(4, '0')}_${migration.name} needs both up and down SQL files`);
    }
    return {
      ...migration,
      checksum: checksum(migration.up, migration.down),
    };
  });
}

export function validateMigrationSequence(migrations) {
  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion) {
      throw new Error(`Migration sequence is incomplete or out of order: expected version ${String(expectedVersion).padStart(4, '0')}, found ${String(migration.version).padStart(4, '0')}`);
    }
  });
}

async function migrationTableExists(client) {
  const result = await client.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
  return result.rows[0].exists;
}

async function readAppliedMigrations(client) {
  if (!(await migrationTableExists(client))) {
    return [];
  }

  const result = await client.query(
    'SELECT version, name, checksum FROM schema_migrations ORDER BY version',
  );
  return result.rows;
}

function validateAppliedMigrations(applied, migrations) {
  for (let index = 0; index < applied.length; index += 1) {
    const row = applied[index];
    const expectedVersion = index + 1;
    if (row.version !== expectedVersion) {
      throw new Error(`Applied migration history is incomplete or out of order: expected version ${String(expectedVersion).padStart(4, '0')}, found ${String(row.version).padStart(4, '0')}`);
    }

    const migration = migrations[index];
    if (!migration || migration.version !== row.version || migration.name !== row.name) {
      throw new Error(`Database contains unknown migration version ${row.version} (${row.name})`);
    }
    if (migration.checksum !== row.checksum) {
      throw new Error(`Migration ${String(row.version).padStart(4, '0')}_${row.name} checksum differs from the applied version`);
    }
  }
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationTable} (
      version integer PRIMARY KEY CHECK (version > 0),
      name text NOT NULL,
      checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function applyUp(client, migrations, applied) {
  const pending = migrations.slice(applied.length);
  for (const migration of pending) {
    const label = `${String(migration.version).padStart(4, '0')}_${migration.name}`;
    await client.query('BEGIN');
    try {
      await client.query(migration.up);
      await client.query(
        `INSERT INTO ${migrationTable} (version, name, checksum) VALUES ($1, $2, $3)`,
        [migration.version, migration.name, migration.checksum],
      );
      await client.query('COMMIT');
      console.log(`Applied ${label}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to apply migration ${label}: ${error.message}`, { cause: error });
    }
  }

  if (pending.length === 0) {
    console.log('Database schema is up to date.');
  }
}

async function applyDown(client, migrations, applied) {
  if (applied.length === 0) {
    throw new Error('No applied migration is available to roll back.');
  }

  const row = applied.at(-1);
  const migration = migrations.at(-1);
  const label = `${String(row.version).padStart(4, '0')}_${row.name}`;

  await client.query('BEGIN');
  try {
    await client.query(migration.down);
    await client.query(`DELETE FROM ${migrationTable} WHERE version = $1`, [row.version]);
    await client.query('COMMIT');
    console.log(`Rolled back ${label}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to roll back migration ${label}: ${error.message}`, { cause: error });
  }
}

export async function runMigrations(
  direction,
  databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl,
) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run database migrations.');
  }
  if (!['up', 'down', 'status'].includes(direction)) {
    throw new Error(`Unsupported migration direction: ${direction}`);
  }

  const migrations = await loadMigrations();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1, $2)', [
      advisoryLockFirstKey,
      advisoryLockSecondKey,
    ]);

    if (direction === 'up') {
      await ensureMigrationTable(client);
    }
    const applied = await readAppliedMigrations(client);
    validateAppliedMigrations(applied, migrations);

    if (direction === 'up') {
      await applyUp(client, migrations, applied);
    } else if (direction === 'down') {
      await applyDown(client, migrations, applied);
    } else {
      const appliedVersions = new Set(applied.map((migration) => migration.version));
      for (const migration of migrations) {
        const label = `${String(migration.version).padStart(4, '0')}_${migration.name}`;
        console.log(`${appliedVersions.has(migration.version) ? 'Applied' : 'Pending'} ${label}`);
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [
        advisoryLockFirstKey,
        advisoryLockSecondKey,
      ]);
    } finally {
      await client.end();
    }
  }
}

const command = process.argv[2];
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!['up', 'down', 'status', 'check'].includes(command)) {
    console.error('Usage: node scripts/migrate.mjs <up|down|status|check>');
    process.exitCode = 2;
  } else if (command === 'check') {
    loadMigrations()
      .then((migrations) => {
        console.log(`Migration files valid (${migrations.length} version${migrations.length === 1 ? '' : 's'}).`);
      })
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  } else {
    runMigrations(command)
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  }
}
