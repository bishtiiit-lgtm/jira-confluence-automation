import { Pool, type PoolClient } from 'pg';
import { loadEnvironment } from '../config/environment.js';

export type DatabaseExecutor = Pool | PoolClient;

export class PersistenceConstraintError extends Error {
  readonly constraint: string | null;
  readonly databaseCode: string;

  constructor(databaseCode: string, constraint: string | null) {
    super(
      constraint
        ? `Database constraint ${constraint} was violated.`
        : 'A database constraint was violated.',
    );
    this.name = 'PersistenceConstraintError';
    this.databaseCode = databaseCode;
    this.constraint = constraint;
  }
}

export function createDatabasePool(
  connectionString = loadEnvironment().databaseUrl,
): Pool {
  return new Pool({ connectionString });
}

export async function withTransaction<T>(
  pool: Pool,
  action: (transaction: PoolClient) => Promise<T>,
): Promise<T> {
  const transaction = await pool.connect();
  try {
    await transaction.query('BEGIN');
    const result = await action(transaction);
    await transaction.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await transaction.query('ROLLBACK');
    } catch {
      // Preserve the original transaction failure.
    }
    throw error;
  } finally {
    transaction.release();
  }
}

export function rethrowPersistenceError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('23')
  ) {
    const constraint =
      'constraint' in error && typeof error.constraint === 'string'
        ? error.constraint
        : null;
    throw new PersistenceConstraintError(error.code, constraint);
  }
  throw error;
}
