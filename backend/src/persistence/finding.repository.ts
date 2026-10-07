import type { QueryResultRow } from 'pg';
import { rethrowPersistenceError, type DatabaseExecutor } from './database.js';
import type { FindingInput, FindingSignalInput, Severity } from './types.js';

interface IdRow extends QueryResultRow {
  id: string;
}

interface FindingRow extends QueryResultRow {
  id: string;
  report_run_id: string;
  sprint_snapshot_id: string | null;
  jira_issue_key: string;
  severity: Severity;
  evidence: Record<string, unknown>;
  recommendation: string;
  suggested_owner: string | null;
  target_date: string | null;
  source_url: string;
  detected_at: Date;
}

export interface FindingRecord {
  id: string;
  reportRunId: string;
  sprintSnapshotId: string | null;
  jiraIssueKey: string;
  severity: Severity;
  evidence: Record<string, unknown>;
  recommendation: string;
  suggestedOwner: string | null;
  targetDate: string | null;
  sourceUrl: string;
  detectedAt: Date;
}

function mapFinding(row: FindingRow): FindingRecord {
  return {
    id: row.id,
    reportRunId: row.report_run_id,
    sprintSnapshotId: row.sprint_snapshot_id,
    jiraIssueKey: row.jira_issue_key,
    severity: row.severity,
    evidence: row.evidence,
    recommendation: row.recommendation,
    suggestedOwner: row.suggested_owner,
    targetDate: row.target_date,
    sourceUrl: row.source_url,
    detectedAt: row.detected_at,
  };
}

const findingColumns = `
  id, report_run_id, sprint_snapshot_id, jira_issue_key, severity, evidence,
  recommendation, suggested_owner, target_date::text, source_url, detected_at
`;

export class FindingRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async upsert(input: FindingInput): Promise<string> {
    try {
      const result = await this.database.query<IdRow>(
        `INSERT INTO findings (
           report_run_id, sprint_snapshot_id, jira_issue_key, severity, evidence,
           recommendation, suggested_owner, target_date, source_url, detected_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT ON CONSTRAINT findings_identity_uq DO UPDATE
         SET severity = EXCLUDED.severity,
             evidence = EXCLUDED.evidence,
             recommendation = EXCLUDED.recommendation,
             suggested_owner = EXCLUDED.suggested_owner,
             target_date = EXCLUDED.target_date,
             source_url = EXCLUDED.source_url,
             detected_at = EXCLUDED.detected_at
         RETURNING id`,
        [
          input.reportRunId,
          input.sprintSnapshotId ?? null,
          input.jiraIssueKey,
          input.severity,
          input.evidence,
          input.recommendation,
          input.suggestedOwner ?? null,
          input.targetDate ?? null,
          input.sourceUrl,
          input.detectedAt,
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async upsertSignal(input: FindingSignalInput): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO finding_signals (
           finding_id, signal_type, severity, threshold_snapshot, evidence
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (finding_id, signal_type) DO UPDATE
         SET severity = EXCLUDED.severity,
             threshold_snapshot = EXCLUDED.threshold_snapshot,
             evidence = EXCLUDED.evidence`,
        [
          input.findingId,
          input.signalType,
          input.severity,
          input.thresholdSnapshot,
          input.evidence,
        ],
      );
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async getById(id: string): Promise<FindingRecord | null> {
    try {
      const result = await this.database.query<FindingRow>(
        `SELECT ${findingColumns} FROM findings WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapFinding(result.rows[0]) : null;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async listByRun(input: {
    reportRunId: string;
    limit: number;
    beforeId?: string | null;
  }): Promise<FindingRecord[]> {
    if (
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new RangeError('Finding page size must be between 1 and 100.');
    }

    try {
      const result = await this.database.query<FindingRow>(
        `SELECT ${findingColumns}
         FROM findings
         WHERE report_run_id = $1
           AND ($2::uuid IS NULL OR id < $2::uuid)
         ORDER BY id DESC
         LIMIT $3`,
        [input.reportRunId, input.beforeId ?? null, input.limit],
      );
      return result.rows.map(mapFinding);
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }
}
