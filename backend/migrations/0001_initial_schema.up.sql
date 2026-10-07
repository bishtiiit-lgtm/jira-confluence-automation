CREATE TABLE business_configuration_versions (
  version bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
  changed_by text,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  scope_key text NOT NULL,
  requested_scope jsonb NOT NULL CHECK (jsonb_typeof(requested_scope) = 'object'),
  trigger_type text NOT NULL CHECK (trigger_type IN ('Scheduled', 'Manual')),
  created_by text,
  report_period_start date NOT NULL,
  report_period_end date NOT NULL,
  report_timezone text NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'Queued',
      'Running',
      'Completed',
      'Completed with delivery warnings',
      'Failed'
    )
  ),
  current_stage text,
  correlation_id text NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT report_runs_period_order CHECK (report_period_start <= report_period_end)
);

CREATE UNIQUE INDEX report_runs_active_scope_period_uidx
  ON report_runs (scope_key, report_period_start, report_period_end)
  WHERE status IN ('Queued', 'Running');
CREATE INDEX report_runs_created_status_idx ON report_runs (created_at DESC, status);
CREATE INDEX report_runs_period_scope_idx
  ON report_runs (report_period_start, report_period_end, scope_key);

CREATE TABLE run_configuration_snapshots (
  report_run_id uuid PRIMARY KEY REFERENCES report_runs(id) ON DELETE RESTRICT,
  configuration_version bigint REFERENCES business_configuration_versions(version) ON DELETE RESTRICT,
  effective_settings jsonb NOT NULL CHECK (jsonb_typeof(effective_settings) = 'object'),
  settings_hash text NOT NULL CHECK (settings_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
  project_key text NOT NULL CHECK (project_key ~ '^[A-Z][A-Z0-9_]{1,9}$'),
  name text,
  source_url text,
  captured_at timestamptz NOT NULL,
  CONSTRAINT project_snapshots_run_key_uq UNIQUE (report_run_id, project_key),
  CONSTRAINT project_snapshots_id_run_project_uq UNIQUE (id, report_run_id, project_key)
);

CREATE TABLE sprint_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  project_key text NOT NULL,
  jira_sprint_id text NOT NULL,
  name text NOT NULL,
  state text NOT NULL CHECK (state IN ('future', 'active', 'closed')),
  start_at timestamptz,
  end_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT sprint_snapshots_project_fk
    FOREIGN KEY (report_run_id, project_key)
    REFERENCES project_snapshots(report_run_id, project_key) ON DELETE RESTRICT,
  CONSTRAINT sprint_snapshots_run_project_jira_uq
    UNIQUE (report_run_id, project_key, jira_sprint_id),
  CONSTRAINT sprint_snapshots_id_run_uq UNIQUE (id, report_run_id)
);

CREATE INDEX sprint_snapshots_run_state_idx ON sprint_snapshots (report_run_id, state);

CREATE TABLE issue_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  project_key text NOT NULL,
  jira_issue_key text NOT NULL,
  summary text NOT NULL,
  issue_type text,
  status_name text,
  status_category text,
  priority_name text,
  assignee_account_id text,
  assignee_display_name text,
  reporter_account_id text,
  reporter_display_name text,
  due_date date,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  original_estimate_seconds bigint CHECK (original_estimate_seconds IS NULL OR original_estimate_seconds >= 0),
  remaining_estimate_seconds bigint CHECK (remaining_estimate_seconds IS NULL OR remaining_estimate_seconds >= 0),
  story_points numeric(12, 3) CHECK (story_points IS NULL OR story_points >= 0),
  labels text[] NOT NULL DEFAULT '{}',
  source_url text NOT NULL,
  CONSTRAINT issue_snapshots_project_fk
    FOREIGN KEY (report_run_id, project_key)
    REFERENCES project_snapshots(report_run_id, project_key) ON DELETE RESTRICT,
  CONSTRAINT issue_snapshots_run_issue_uq UNIQUE (report_run_id, jira_issue_key),
  CONSTRAINT issue_snapshots_id_run_uq UNIQUE (id, report_run_id)
);

CREATE INDEX issue_snapshots_run_project_idx ON issue_snapshots (report_run_id, project_key);
CREATE INDEX issue_snapshots_run_updated_idx ON issue_snapshots (report_run_id, updated_at);

CREATE TABLE issue_sprint_memberships (
  report_run_id uuid NOT NULL,
  issue_snapshot_id uuid NOT NULL,
  sprint_snapshot_id uuid NOT NULL,
  PRIMARY KEY (report_run_id, issue_snapshot_id, sprint_snapshot_id),
  CONSTRAINT issue_sprint_memberships_issue_fk
    FOREIGN KEY (issue_snapshot_id, report_run_id)
    REFERENCES issue_snapshots(id, report_run_id) ON DELETE RESTRICT,
  CONSTRAINT issue_sprint_memberships_sprint_fk
    FOREIGN KEY (sprint_snapshot_id, report_run_id)
    REFERENCES sprint_snapshots(id, report_run_id) ON DELETE RESTRICT
);

CREATE INDEX issue_sprint_memberships_sprint_idx
  ON issue_sprint_memberships (report_run_id, sprint_snapshot_id);

CREATE TABLE issue_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL,
  jira_link_id text NOT NULL,
  source_issue_id uuid NOT NULL,
  target_issue_id uuid,
  target_issue_key text NOT NULL,
  link_type_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inward', 'outward')),
  CONSTRAINT issue_links_source_fk
    FOREIGN KEY (source_issue_id, report_run_id)
    REFERENCES issue_snapshots(id, report_run_id) ON DELETE RESTRICT,
  CONSTRAINT issue_links_target_fk
    FOREIGN KEY (target_issue_id, report_run_id)
    REFERENCES issue_snapshots(id, report_run_id) ON DELETE RESTRICT,
  CONSTRAINT issue_links_run_jira_link_uq UNIQUE (report_run_id, jira_link_id)
);

CREATE INDEX issue_links_run_target_key_idx ON issue_links (report_run_id, target_issue_key);

CREATE TABLE findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
  sprint_snapshot_id uuid,
  jira_issue_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('High', 'Medium', 'Low')),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  recommendation text NOT NULL,
  suggested_owner text,
  target_date date,
  source_url text NOT NULL,
  detected_at timestamptz NOT NULL,
  CONSTRAINT findings_issue_fk
    FOREIGN KEY (report_run_id, jira_issue_key)
    REFERENCES issue_snapshots(report_run_id, jira_issue_key) ON DELETE RESTRICT,
  CONSTRAINT findings_sprint_fk
    FOREIGN KEY (sprint_snapshot_id, report_run_id)
    REFERENCES sprint_snapshots(id, report_run_id) ON DELETE RESTRICT,
  CONSTRAINT findings_identity_uq
    UNIQUE NULLS NOT DISTINCT (report_run_id, sprint_snapshot_id, jira_issue_key)
);

CREATE INDEX findings_run_severity_idx ON findings (report_run_id, severity);
CREATE INDEX findings_sprint_severity_idx ON findings (sprint_snapshot_id, severity);

CREATE TABLE finding_signals (
  finding_id uuid NOT NULL REFERENCES findings(id) ON DELETE RESTRICT,
  signal_type text NOT NULL CHECK (
    signal_type IN (
      'overdue',
      'blocked',
      'stale',
      'missed_commitment',
      'high_priority',
      'dependency_risk',
      'story_point_variance'
    )
  ),
  severity text NOT NULL CHECK (severity IN ('High', 'Medium', 'Low')),
  threshold_snapshot jsonb NOT NULL CHECK (jsonb_typeof(threshold_snapshot) = 'object'),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  PRIMARY KEY (finding_id, signal_type)
);

CREATE INDEX finding_signals_type_finding_idx ON finding_signals (signal_type, finding_id);

CREATE TABLE risk_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
  scope_type text NOT NULL CHECK (scope_type IN ('overall', 'project', 'sprint')),
  project_key text,
  sprint_snapshot_id uuid,
  overall_severity text NOT NULL CHECK (overall_severity IN ('High', 'Medium', 'Low', 'No findings')),
  finding_count integer NOT NULL CHECK (finding_count >= 0),
  generated_at timestamptz NOT NULL,
  CONSTRAINT risk_summaries_project_fk
    FOREIGN KEY (report_run_id, project_key)
    REFERENCES project_snapshots(report_run_id, project_key) ON DELETE RESTRICT,
  CONSTRAINT risk_summaries_sprint_fk
    FOREIGN KEY (sprint_snapshot_id, report_run_id)
    REFERENCES sprint_snapshots(id, report_run_id) ON DELETE RESTRICT,
  CONSTRAINT risk_summaries_scope_shape CHECK (
    (scope_type = 'overall' AND project_key IS NULL AND sprint_snapshot_id IS NULL)
    OR (scope_type = 'project' AND project_key IS NOT NULL AND sprint_snapshot_id IS NULL)
    OR (scope_type = 'sprint' AND project_key IS NOT NULL AND sprint_snapshot_id IS NOT NULL)
  ),
  CONSTRAINT risk_summaries_identity_uq
    UNIQUE NULLS NOT DISTINCT (report_run_id, scope_type, project_key, sprint_snapshot_id)
);

CREATE TABLE risk_summary_counts (
  risk_summary_id uuid NOT NULL REFERENCES risk_summaries(id) ON DELETE RESTRICT,
  dimension text NOT NULL CHECK (dimension IN ('severity', 'signal')),
  value text NOT NULL,
  count integer NOT NULL CHECK (count >= 0),
  PRIMARY KEY (risk_summary_id, dimension, value)
);

CREATE TABLE publication_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
  destination text NOT NULL CHECK (destination IN ('confluence', 'email', 'teams')),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('Pending', 'Succeeded', 'Failed', 'Skipped')),
  external_reference text,
  attempted_at timestamptz NOT NULL,
  completed_at timestamptz,
  sanitized_error text,
  CONSTRAINT publication_attempts_run_destination_attempt_uq
    UNIQUE (report_run_id, destination, attempt_number)
);

CREATE INDEX publication_attempts_run_destination_status_idx
  ON publication_attempts (report_run_id, destination, status);

CREATE TABLE workflow_artifact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  artifact_name text NOT NULL,
  workflow_run_id text,
  artifact_url text,
  status text NOT NULL CHECK (status IN ('Pending', 'Succeeded', 'Failed', 'Skipped')),
  attempted_at timestamptz NOT NULL,
  completed_at timestamptz,
  expires_at timestamptz,
  sanitized_error text,
  CONSTRAINT workflow_artifact_attempts_run_number_uq UNIQUE (report_run_id, attempt_number)
);

CREATE INDEX workflow_artifact_attempts_run_status_idx
  ON workflow_artifact_attempts (report_run_id, status);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_run_id uuid,
  actor_identifier text,
  event_name text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  correlation_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_occurred_event_idx ON audit_events (occurred_at DESC, event_name);
CREATE INDEX audit_events_report_run_idx ON audit_events (report_run_id) WHERE report_run_id IS NOT NULL;
