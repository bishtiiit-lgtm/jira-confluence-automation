import type { QueryResultRow } from 'pg';
import { rethrowPersistenceError, type DatabaseExecutor } from './database.js';
import type {
  RiskSummaryCountInput,
  RiskSummaryInput,
  SummarySeverity,
} from './types.js';

interface SummaryIdRow extends QueryResultRow {
  id: string;
}

interface SummaryRow extends QueryResultRow {
  id: string;
  report_run_id: string;
  scope_type: 'overall' | 'project' | 'sprint';
  project_key: string | null;
  sprint_snapshot_id: string | null;
  overall_severity: SummarySeverity;
  finding_count: number;
  generated_at: Date;
}

export interface RiskSummaryRecord {
  id: string;
  reportRunId: string;
  scopeType: 'overall' | 'project' | 'sprint';
  projectKey: string | null;
  sprintSnapshotId: string | null;
  overallSeverity: SummarySeverity;
  findingCount: number;
  generatedAt: Date;
}

function mapSummary(row: SummaryRow): RiskSummaryRecord {
  return {
    id: row.id,
    reportRunId: row.report_run_id,
    scopeType: row.scope_type,
    projectKey: row.project_key,
    sprintSnapshotId: row.sprint_snapshot_id,
    overallSeverity: row.overall_severity,
    findingCount: row.finding_count,
    generatedAt: row.generated_at,
  };
}

export class RiskSummaryRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async upsert(input: RiskSummaryInput): Promise<string> {
    try {
      const result = await this.database.query<SummaryIdRow>(
        `INSERT INTO risk_summaries (
           report_run_id, scope_type, project_key, sprint_snapshot_id,
           overall_severity, finding_count, generated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ON CONSTRAINT risk_summaries_identity_uq DO UPDATE
         SET overall_severity = EXCLUDED.overall_severity,
             finding_count = EXCLUDED.finding_count,
             generated_at = EXCLUDED.generated_at
         RETURNING id`,
        [
          input.reportRunId,
          input.scopeType,
          input.projectKey ?? null,
          input.sprintSnapshotId ?? null,
          input.overallSeverity,
          input.findingCount,
          input.generatedAt,
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async upsertCount(input: RiskSummaryCountInput): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO risk_summary_counts (risk_summary_id, dimension, value, count)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (risk_summary_id, dimension, value) DO UPDATE
         SET count = EXCLUDED.count`,
        [input.riskSummaryId, input.dimension, input.value, input.count],
      );
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async listByRun(reportRunId: string): Promise<RiskSummaryRecord[]> {
    try {
      const result = await this.database.query<SummaryRow>(
        `SELECT id, report_run_id, scope_type, project_key, sprint_snapshot_id,
                overall_severity, finding_count, generated_at
         FROM risk_summaries
         WHERE report_run_id = $1
         ORDER BY scope_type, project_key NULLS FIRST, sprint_snapshot_id NULLS FIRST`,
        [reportRunId],
      );
      return result.rows.map(mapSummary);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }
}
