import type { QueryResultRow } from 'pg';
import { rethrowPersistenceError, type DatabaseExecutor } from './database.js';
import type {
  IssueLinkInput,
  IssueSnapshotInput,
  ProjectSnapshotInput,
  RunConfigurationSnapshotInput,
  SprintSnapshotInput,
} from './types.js';

interface IdRow extends QueryResultRow {
  id: string;
}

export class SnapshotRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async createRunConfigurationSnapshot(
    input: RunConfigurationSnapshotInput,
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO run_configuration_snapshots (
           report_run_id, configuration_version, effective_settings, settings_hash
         ) VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_run_id) DO NOTHING`,
        [
          input.reportRunId,
          input.configurationVersion ?? null,
          input.effectiveSettings,
          input.settingsHash,
        ],
      );

      const existing = await this.database.query<{
        settings_match: boolean;
        settings_hash: string;
      }>(
        `SELECT effective_settings = $2::jsonb AS settings_match, settings_hash
         FROM run_configuration_snapshots WHERE report_run_id = $1`,
        [input.reportRunId, input.effectiveSettings],
      );
      if (
        !existing.rows[0] ||
        existing.rows[0].settings_hash !== input.settingsHash ||
        !existing.rows[0].settings_match
      ) {
        throw new Error(
          'A report run configuration snapshot is immutable once created.',
        );
      }
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async upsertProject(input: ProjectSnapshotInput): Promise<string> {
    try {
      const result = await this.database.query<IdRow>(
        `INSERT INTO project_snapshots (
           report_run_id, project_key, name, source_url, captured_at
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (report_run_id, project_key) DO UPDATE
         SET name = EXCLUDED.name,
             source_url = EXCLUDED.source_url,
             captured_at = EXCLUDED.captured_at
         RETURNING id`,
        [
          input.reportRunId,
          input.projectKey,
          input.name ?? null,
          input.sourceUrl ?? null,
          input.capturedAt,
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async upsertSprint(input: SprintSnapshotInput): Promise<string> {
    try {
      const result = await this.database.query<IdRow>(
        `INSERT INTO sprint_snapshots (
           report_run_id, project_key, jira_sprint_id, name, state,
           start_at, end_at, completed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (report_run_id, project_key, jira_sprint_id) DO UPDATE
         SET name = EXCLUDED.name,
             state = EXCLUDED.state,
             start_at = EXCLUDED.start_at,
             end_at = EXCLUDED.end_at,
             completed_at = EXCLUDED.completed_at
         RETURNING id`,
        [
          input.reportRunId,
          input.projectKey,
          input.jiraSprintId,
          input.name,
          input.state,
          input.startAt ?? null,
          input.endAt ?? null,
          input.completedAt ?? null,
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async upsertIssue(input: IssueSnapshotInput): Promise<string> {
    try {
      const result = await this.database.query<IdRow>(
        `INSERT INTO issue_snapshots (
           report_run_id, project_key, jira_issue_key, summary, issue_type,
           status_name, status_category, priority_name, assignee_account_id,
           assignee_display_name, reporter_account_id, reporter_display_name,
           due_date, created_at, updated_at, resolved_at,
           original_estimate_seconds, remaining_estimate_seconds, story_points,
           labels, source_url
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19, $20, $21
         )
         ON CONFLICT (report_run_id, jira_issue_key) DO UPDATE
         SET project_key = EXCLUDED.project_key,
             summary = EXCLUDED.summary,
             issue_type = EXCLUDED.issue_type,
             status_name = EXCLUDED.status_name,
             status_category = EXCLUDED.status_category,
             priority_name = EXCLUDED.priority_name,
             assignee_account_id = EXCLUDED.assignee_account_id,
             assignee_display_name = EXCLUDED.assignee_display_name,
             reporter_account_id = EXCLUDED.reporter_account_id,
             reporter_display_name = EXCLUDED.reporter_display_name,
             due_date = EXCLUDED.due_date,
             created_at = EXCLUDED.created_at,
             updated_at = EXCLUDED.updated_at,
             resolved_at = EXCLUDED.resolved_at,
             original_estimate_seconds = EXCLUDED.original_estimate_seconds,
             remaining_estimate_seconds = EXCLUDED.remaining_estimate_seconds,
             story_points = EXCLUDED.story_points,
             labels = EXCLUDED.labels,
             source_url = EXCLUDED.source_url
         RETURNING id`,
        [
          input.reportRunId,
          input.projectKey,
          input.jiraIssueKey,
          input.summary,
          input.issueType ?? null,
          input.statusName ?? null,
          input.statusCategory ?? null,
          input.priorityName ?? null,
          input.assigneeAccountId ?? null,
          input.assigneeDisplayName ?? null,
          input.reporterAccountId ?? null,
          input.reporterDisplayName ?? null,
          input.dueDate ?? null,
          input.createdAt ?? null,
          input.updatedAt ?? null,
          input.resolvedAt ?? null,
          input.originalEstimateSeconds ?? null,
          input.remainingEstimateSeconds ?? null,
          input.storyPoints ?? null,
          input.labels ?? [],
          input.sourceUrl,
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async addIssueSprintMembership(
    reportRunId: string,
    issueSnapshotId: string,
    sprintSnapshotId: string,
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO issue_sprint_memberships (
           report_run_id, issue_snapshot_id, sprint_snapshot_id
         ) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [reportRunId, issueSnapshotId, sprintSnapshotId],
      );
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async upsertIssueLink(input: IssueLinkInput): Promise<string> {
    try {
      const result = await this.database.query<IdRow>(
        `INSERT INTO issue_links (
           report_run_id, jira_link_id, source_issue_id, target_issue_id,
           target_issue_key, link_type_name, direction
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (report_run_id, jira_link_id) DO UPDATE
         SET source_issue_id = EXCLUDED.source_issue_id,
             target_issue_id = EXCLUDED.target_issue_id,
             target_issue_key = EXCLUDED.target_issue_key,
             link_type_name = EXCLUDED.link_type_name,
             direction = EXCLUDED.direction
         RETURNING id`,
        [
          input.reportRunId,
          input.jiraLinkId,
          input.sourceIssueId,
          input.targetIssueId ?? null,
          input.targetIssueKey,
          input.linkTypeName,
          input.direction,
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }
}
