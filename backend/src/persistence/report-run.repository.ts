import type { QueryResultRow } from 'pg';
import { rethrowPersistenceError, type DatabaseExecutor } from './database.js';
import type {
  CreateReportRunInput,
  CreateReportRunResult,
  ReportRun,
  ReportRunCursor,
  ReportRunPage,
  ReportRunStatus,
} from './types.js';

interface ReportRunRow extends QueryResultRow {
  id: string;
  idempotency_key: string;
  scope_key: string;
  requested_scope: Record<string, unknown>;
  trigger_type: 'Scheduled' | 'Manual';
  created_by: string | null;
  report_period_start: string;
  report_period_end: string;
  report_timezone: string;
  status: ReportRunStatus;
  current_stage: string | null;
  correlation_id: string;
  error_code: string | null;
  created_at: string;
  started_at: Date | null;
  completed_at: Date | null;
}

const reportRunColumns = `
  id,
  idempotency_key,
  scope_key,
  requested_scope,
  trigger_type,
  created_by,
  report_period_start::text,
  report_period_end::text,
  report_timezone,
  status,
  current_stage,
  correlation_id,
  error_code,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
  started_at,
  completed_at
`;

function mapReportRun(row: ReportRunRow): ReportRun {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    scopeKey: row.scope_key,
    requestedScope: row.requested_scope,
    triggerType: row.trigger_type,
    createdBy: row.created_by,
    reportPeriodStart: row.report_period_start,
    reportPeriodEnd: row.report_period_end,
    reportTimezone: row.report_timezone,
    status: row.status,
    currentStage: row.current_stage,
    correlationId: row.correlation_id,
    errorCode: row.error_code,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

export class ReportRunRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async createOrGet(
    input: CreateReportRunInput,
  ): Promise<CreateReportRunResult> {
    try {
      const inserted = await this.database.query<ReportRunRow>(
        `INSERT INTO report_runs (
           idempotency_key, scope_key, requested_scope, trigger_type, created_by,
           report_period_start, report_period_end, report_timezone, status, correlation_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Queued', $9)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING ${reportRunColumns}`,
        [
          input.idempotencyKey,
          input.scopeKey,
          input.requestedScope,
          input.triggerType,
          input.createdBy ?? null,
          input.reportPeriodStart,
          input.reportPeriodEnd,
          input.reportTimezone,
          input.correlationId,
        ],
      );
      if (inserted.rows[0]) {
        return { run: mapReportRun(inserted.rows[0]), created: true };
      }

      const existing = await this.getByIdempotencyKey(input.idempotencyKey);
      if (!existing) {
        throw new Error(
          'Idempotency conflict occurred but no existing run was found.',
        );
      }
      const matchesRequest =
        existing.scopeKey === input.scopeKey &&
        existing.triggerType === input.triggerType &&
        existing.reportPeriodStart === input.reportPeriodStart &&
        existing.reportPeriodEnd === input.reportPeriodEnd &&
        existing.reportTimezone === input.reportTimezone &&
        stableJson(existing.requestedScope) ===
          stableJson(input.requestedScope);
      if (!matchesRequest) {
        throw new Error(
          'Idempotency key was already used for a different report request.',
        );
      }
      return { run: existing, created: false };
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async getById(id: string): Promise<ReportRun | null> {
    try {
      const result = await this.database.query<ReportRunRow>(
        `SELECT ${reportRunColumns} FROM report_runs WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapReportRun(result.rows[0]) : null;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<ReportRun | null> {
    try {
      const result = await this.database.query<ReportRunRow>(
        `SELECT ${reportRunColumns} FROM report_runs WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      return result.rows[0] ? mapReportRun(result.rows[0]) : null;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async updateStatus(
    id: string,
    status: ReportRunStatus,
    currentStage: string | null = null,
    errorCode: string | null = null,
  ): Promise<ReportRun | null> {
    try {
      const result = await this.database.query<ReportRunRow>(
        `UPDATE report_runs
         SET status = $2,
             current_stage = $3,
             error_code = $4,
             started_at = CASE WHEN $2 = 'Running' THEN COALESCE(started_at, now()) ELSE started_at END,
             completed_at = CASE
               WHEN $2 IN ('Completed', 'Completed with delivery warnings', 'Failed') THEN COALESCE(completed_at, now())
               ELSE completed_at
             END
         WHERE id = $1
         RETURNING ${reportRunColumns}`,
        [id, status, currentStage, errorCode],
      );
      return result.rows[0] ? mapReportRun(result.rows[0]) : null;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async list(input: {
    limit: number;
    cursor?: ReportRunCursor | null;
    status?: ReportRunStatus;
  }): Promise<ReportRunPage> {
    if (
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new RangeError('Report run page size must be between 1 and 100.');
    }

    try {
      const result = await this.database.query<ReportRunRow>(
        `SELECT ${reportRunColumns}
         FROM report_runs
         WHERE ($1::timestamptz IS NULL OR (created_at, id) < ($1, $2::uuid))
           AND ($3::text IS NULL OR status = $3)
         ORDER BY created_at DESC, id DESC
         LIMIT $4`,
        [
          input.cursor?.createdAt ?? null,
          input.cursor?.id ?? null,
          input.status ?? null,
          input.limit + 1,
        ],
      );
      const hasMore = result.rows.length > input.limit;
      const items = result.rows.slice(0, input.limit).map(mapReportRun);
      const lastItem = items.at(-1);
      return {
        items,
        nextCursor:
          hasMore && lastItem
            ? { createdAt: lastItem.createdAt, id: lastItem.id }
            : null,
      };
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }
}
