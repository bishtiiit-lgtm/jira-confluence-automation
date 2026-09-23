# Feature Specification: Jira/Confluence Delivery Risk Summary

**Status:** Approved for implementation planning
**Version:** 1.1.0
**Date:** 2026-09-23
**Constitution:** `spec/constitution.md` v1.0.0

## 1. Summary

Build a web application and scheduled automation that collects delivery data from Jira, evaluates configurable delivery-risk rules, stores normalized run data in PostgreSQL 15, and publishes a canonical Markdown Delivery Risk Summary to Confluence and approved delivery channels.

The application serves a Delivery Manager overseeing product development work in Jira projects `SAM1` and `KAN`. It supports a weekly scheduled run every Monday at 09:00 Asia/Kolkata and an authorized manual run with optional project and sprint scope.

## 2. Goals and Non-Goals

### Goals

- Identify delivery risks without requiring manual Jira review.
- Explain every finding with a rule, severity, evidence, owner, and Jira source link.
- Provide consistent report content across the web UI, Confluence, email, Teams, and GitHub Actions artifacts.
- Preserve historical runs and dated Confluence report sections.
- Make thresholds, destinations, and integration details configurable and validated.
- Provide safe failure behavior, sanitized diagnostics, and actionable configuration errors.

### Non-Goals

- Replacing Jira, Confluence, sprint planning, or issue editing workflows.
- Calculating risk in the browser.
- Storing Jira credentials or other secrets in the frontend, database records, reports, or source control.
- Automatically changing Jira issues, sprint scope, estimates, or statuses.
- Enabling broad Confluence edit access without explicit approval.

## 3. Users and Permissions

### Delivery Manager

Can view current and historical reports, filter findings, inspect evidence, trigger an authorized manual run, and review delivery outcomes.

### Report Viewer

Can view reports, summaries, findings, source links, and run status. Viewers cannot trigger runs, change configuration, or modify integrations.

### Administrator

Can manage database-backed non-secret business settings, thresholds, destination enablement, and operational controls. Deployment-managed environment values and secrets are read-only in the UI; administrators can validate their presence but cannot view or edit secret values. Administrator actions must be authenticated, authorized, audited, and protected from accidental disclosure.

### Automation Worker

Runs the same command invoked by scheduled and manually dispatched GitHub Actions workflows, using environment-scoped deployment credentials. It can retrieve external data, persist normalized results, publish configured outputs, and record sanitized audit events. GitHub Actions is the scheduler and worker host for MVP; no long-running worker or queue service is required.

## 4. User Scenarios and Acceptance Tests

### P1: View the latest delivery-risk report

**Given** a completed report exists for the configured scope and period, **when** an authorized user opens the dashboard, **then** the system displays the overall risk level, project and sprint summaries, finding counts by severity and rule, generation time in Asia/Kolkata, and links to the detailed report and Jira sources.

**Acceptance tests:**

- The dashboard identifies the report period, projects, sprints, and run outcome.
- High, Medium, and Low counts are visible and reconcile with the stored findings.
- Missing optional owner, sprint, or due-date values do not break rendering.
- The UI displays a clear empty state when no completed report exists.

### P1: Generate a report manually

**Given** an authorized user selects an optional project and sprint scope, **when** the user starts a report run, **then** the backend validates the scope, creates one idempotent run request, and dispatches the same GitHub Actions workflow used by the schedule. The UI exposes queued, running, and final outcomes.

**Acceptance tests:**

- Project scope accepts `SAM1`, `KAN`, both projects, or the configured default.
- Sprint scope is optional and is validated before external calls begin.
- A duplicate request for the same scope and reporting period does not create duplicate findings or duplicate publication sections.
- Unauthorized users receive a safe authorization error and no job is started.
- A failed run is marked failed and does not publish a successful partial report.

### P1: Run the scheduled weekly report

**Given** the scheduled workflow runs on Monday at 09:00 Asia/Kolkata, **when** the workflow starts, **then** it invokes the same backend report process used by manual execution and publishes the configured outputs on success.

**Acceptance tests:**

- The workflow uses the UTC cron equivalent of Monday 09:00 Asia/Kolkata.
- The scheduled and manual paths produce the same normalized report for the same scope.
- The Markdown report is uploaded as the canonical workflow artifact.
- Sanitized diagnostics are uploaded on failure and the workflow fails clearly.

### P1: Inspect an individual risk finding

**Given** a report contains a finding, **when** an authorized user opens its details, **then** the system shows severity, triggered rule, Jira key, project, sprint, owner when available, evidence, timestamps, recommended action, and source URL.

**Acceptance tests:**

- Multiple triggered signals are shown without creating duplicate finding cards.
- Evidence contains only the fields needed to explain the risk.
- Source links point to the originating Jira issue or relevant Jira resource.
- Secrets, tokens, full comments, and unnecessary personal data are never shown.

### P1: Publish a canonical report

**Given** data retrieval, validation, and risk evaluation succeed, **when** report generation completes, **then** the system renders one canonical Markdown report and publishes consistent content to Confluence, email, Teams, and the workflow artifact.

**Acceptance tests:**

- The report contains an executive summary, grouped findings, recommended actions, timestamps, and Jira links.
- Confluence receives a dated section while preserving prior report history.
- Repeating the same report does not duplicate the same Confluence section or email publication record.
- A destination failure is recorded and reported without exposing credentials.

### P2: Review configuration and integration health

**Given** an administrator opens configuration or health status, **when** the backend checks the system, **then** it reports safe validation results for Jira, Confluence, SMTP, Teams, database, and application health.

**Acceptance tests:**

- Required non-secret values and secret presence are validated separately.
- Health responses never include secret values or complete authorization headers.
- Invalid thresholds, timezone values, URLs, or project keys produce actionable messages.
- Configuration changes are audited and do not silently alter historical reports.

## 5. UI Screens

The frontend shall use a consistent application shell with a primary navigation menu, page title, reporting timezone, current user identity, and authenticated access controls. Screens must be responsive on desktop and mobile widths and must expose loading, empty, success, partial-failure, and retry states where applicable.

### 5.1 Dashboard - Latest Risk Summary

**Route:** `/`

**Purpose:** Give the Delivery Manager an immediate view of current delivery health and the actions requiring attention.

**Visible content:**

- Overall risk banner showing `High`, `Medium`, `Low`, or `No findings`.
- Report period, generated timestamp, scope, last successful run, and run status.
- Summary cards for total findings, High findings, overdue items, blocked items, stale items, and missed commitments.
- A failed data-pipeline run is marked failed and does not publish a report.
- Recent runs table with status, scope, duration, requester or schedule source, and links to details.
- Primary actions: `View report`, `Run report`, and `View run history` according to permissions.

**Interaction rules:**

- Selecting a summary card opens the report view filtered to that signal or severity.
- Selecting a project opens the report view scoped to that project.
- The dashboard must show the report timestamp in Asia/Kolkata and provide the source timezone where useful.
- Viewers can inspect data but cannot see or activate the manual-run action.

**States:**

- Loading skeleton for summary and project regions.
- Empty state explaining that no completed report is available and showing the next scheduled run.
- Partial-failure state when a report exists but one publication destination failed.
- Failure state with a sanitized error, retry action, and link to run details.

### 5.2 Report Detail

**Route:** `/reports/:reportId`

**Purpose:** Present the complete report in a web-readable form while preserving the canonical Markdown report link.

**Visible content:**

- Breadcrumb back to Dashboard and a report header with status, scope, period, and generation time.
- Executive summary with overall severity and change from the previous report.
- Severity breakdown and rule breakdown.
- Project and sprint sections with completion metrics and risk level.
- Filter controls for project, sprint, severity, signal, owner, and finding status.
- Findings table with severity, Jira key, summary, project, sprint, owner, triggered signals, evidence summary, and source link.
- Recommended actions grouped by priority and target date when available.
- Publication status for Confluence, email, Teams, and workflow artifact.
- Actions to download Markdown and open the Confluence page when a link is available.

**Interaction rules:**

- Filters update the visible finding list without recalculating risk.
- Table rows open the Finding Detail screen.
- Jira and Confluence links open in a new tab and are clearly identified as external links.
- The report remains readable when optional fields are unavailable.

### 5.3 Finding Detail

**Route:** `/findings/:findingId`

**Purpose:** Explain why one item is considered a risk and what action is recommended.

**Visible content:**

- Severity badge and finding title.
- Jira issue key, summary, project, sprint, owner, priority, status, due date, and last-updated timestamp when available.
- All triggered signals, with the active threshold shown for each signal.
- Evidence panel showing the sanitized values that caused each signal to trigger.
- Recommended action, suggested owner, and target date when available.
- Links to the Jira issue, related blocking issues, and the parent report.
- Last evaluated timestamp and report run identifier.

**Interaction rules:**

- Signal evidence is expandable but must not expose full Jira comments, credentials, or unnecessary personal data.
- Missing values display as `Not available`, not blank space or a misleading default.
- The page provides a visible back link that preserves the previous report filters.

### 5.4 Run Report

**Route:** `/runs/new`

**Purpose:** Let authorized users start a controlled manual report run.

**Visible content:**

- Project selector with `SAM1`, `KAN`, or both selected by default.
- Optional sprint selector populated from validated Jira data.
- Reporting-period preview and timezone.
- Destination summary showing which configured outputs will be attempted.
- Confirmation step summarizing scope and expected publication behavior.
- Primary `Start report run` action and a cancel action.

**Interaction rules:**

- Only Delivery Managers and Administrators may access this screen.
- Validation errors appear beside the relevant field and in a summary region.
- Starting a run disables duplicate submission and navigates to Run Status.
- The UI must explain that the run is idempotent for the same scope and period.

### 5.5 Run Status

**Route:** `/runs/:runId`

**Purpose:** Show progress and outcome for a scheduled or manual report run.

**Visible content:**

- Run identifier, source (`Scheduled` or `Manual`), requester when permitted, scope, reporting period, and timestamps.
- Stepper for configuration validation, Jira retrieval, normalization, risk evaluation, report rendering, persistence, and publication.
- Progress state for the active step and duration for completed steps.
- Publication result for each destination.
- Sanitized error summary and correlation identifier when the run fails.
- Links to the completed report, Markdown artifact, Confluence page, and retry action where permitted.

**States:**

- `Queued`, `Running`, `Completed`, `Completed with delivery warnings`, and `Failed`.
- A failed run must clearly state that no successful partial report was published.
- Polling or server-sent updates may refresh progress, but the screen must remain usable without real-time updates.

### 5.6 Run History

**Route:** `/runs`

**Purpose:** Provide an audit-friendly history of scheduled and manual report executions.

**Visible content:**

- Paginated table of run date, scope, trigger, status, duration, overall severity, finding count, and publication outcome.
- Filters for date range, project, trigger type, status, and severity.
- Links to report details and run status.
- Empty state when no runs match the filters.

**Interaction rules:**

- Results are paginated server-side.
- Historical records are read-only from the UI.
- Failed runs expose sanitized diagnostics only to authorized users.

### 5.7 Administration and Integration Health

**Route:** `/admin`

**Purpose:** Allow Administrators to review non-secret configuration and integration readiness.

**Visible content:**

- Application and PostgreSQL health.
- Jira, Confluence, SMTP, Teams, and GitHub Actions integration status.
- Non-secret values such as base URLs, project keys, timezone, thresholds, destination enablement, and stable target identifiers.
- Secret status as `Configured` or `Missing`, never the secret value.
- Configuration validation results with remediation guidance.
- Audit history for configuration and permission-sensitive changes.

**Interaction rules:**

- Configuration edits require explicit save confirmation and administrator authorization.
- Secret values cannot be entered into or displayed by the general report UI.
- Health checks must not leak authorization headers, tokens, passwords, or raw upstream responses.

### 5.8 Shared UI Components and States

- **Application shell:** responsive navigation, current user, timezone indicator, and sign-out control.
- **Severity indicator:** consistent color, text label, and non-color icon or text alternative for High, Medium, and Low.
- **Finding table:** keyboard navigable, sortable only where supported, paginated, and usable on narrow screens.
- **Filter bar:** removable filter chips, clear-all action, and URL-persisted filters where practical.
- **External link treatment:** recognizable external-link indicator and accessible label.
- **Notifications:** success, warning, and error messages must be announced to assistive technology.
- **Loading:** preserve layout dimensions with skeletons or progress indicators; do not show misleading zero counts while data is loading.
- **Empty:** explain why no data is present and provide the next useful action.
- **Error:** show a human-readable message, correlation identifier when appropriate, and a retry or navigation action.
- **Responsive behavior:** summary cards stack on mobile; tables provide a mobile-friendly row layout or horizontal scrolling without hiding severity or action controls.

## 6. Functional Requirements

### 6.1 Configuration

- The backend shall load configuration from environment variables and deployment secret stores.
- Deployment-managed non-secret settings shall include Jira base URL, project keys, team identifiers, reporting timezone, Confluence space/page identifiers, report recipients, delivery toggles, and GitHub repository/environment names.
- Database-managed business settings shall include risk thresholds, configurable status and priority mappings, lookback duration, retention periods, and optional destination enablement. Changes are versioned and do not alter historical reports.
- Required secrets shall include the Atlassian user token, SMTP authentication, and Teams webhook or workflow credentials as applicable. The Atlassian token is not required to belong to a service account.
- GitHub Actions shall read secrets from the protected environment named by deployment configuration; secrets shall never be persisted by the application.
- The backend shall fail startup or fail the requested run with actionable errors when required configuration is missing or invalid.
- Thresholds shall support the initial defaults: stale at 5 calendar days, sprint completion at 80%, and final-sprint remaining commitment at 20%.

### 6.2 Jira retrieval and normalization

- The Jira adapter shall authenticate using deployment-managed credentials.
- It shall retrieve all issue types in `SAM1` and `KAN`, active and completed sprints from the configurable 90-day lookback, issue fields, changelogs, issue links, estimates, statuses, and source URLs.
- It shall support pagination, bounded timeouts, safe retries, rate-limit handling, and normalized error reporting.
- It shall apply the configured team filter to Jira participation: an issue is included when a matching team member is the assignee, reporter, watcher, or participant recorded by the configured Jira API. The configured project scope is `KAN` and `SAM1`; unassigned issues are retained when they otherwise belong to the selected project scope and are marked as unassigned.
- It shall normalize external responses into typed domain records before risk evaluation.

### 6.3 Risk evaluation

The risk engine shall evaluate each configured rule:

- **Overdue:** unresolved issue whose due date, interpreted in Asia/Kolkata when no time is supplied, is at least one calendar day before the report `asOf` date.
- **Blocked:** issue is in a configured blocked status, or has an unresolved inward Jira link whose configured type is `blocks`.
- **Stale:** active issue has not been updated for at least five calendar days, excluding no special weekend or holiday treatment. Missing `updated` data is a validation failure, not a stale signal.
- **Missed commitment:** at the sprint end boundary, an issue is incomplete by status category or configured completed-status list. A completion exactly at the end timestamp is on time. A sprint is also at risk when completion is below 80%.
- **High priority:** priority name matches configured `Highest` or `High` values case-insensitively.
- **Dependency risk:** a predecessor identified by a configured `blocks` link is overdue, blocked, or stale.
- **Story-point variance:** completed points are below 80% of committed points, or remaining points exceed 20% of original commitment during the final 20% of the sprint. Jira `Original estimate` is the estimate field; null or fractional values are retained and excluded from point arithmetic when unavailable. Zero commitment produces no variance percentage and an explicit not-applicable result.

The engine shall assign severity using the highest-severity triggered signal: overdue, blocked, missed commitment, and dependency risk are `High`; stale, high priority, and story-point variance are `Medium`; low-confidence informational signals are `Low`. Any High finding makes its project, sprint, and overall report severity High; otherwise any Medium makes it Medium; otherwise it is Low or `No findings`. Findings use `(reportRunId, sprintId-or-null, jiraIssueKey)` as the uniqueness key and merge signals in deterministic rule order.

### 6.4 Reports and publication

- Markdown shall be the canonical report format.
- The report shall include generation timestamp, reporting period, overall risk, project and sprint summaries, grouped findings, severity, evidence, recommendations, and Jira source links.
- The Confluence adapter shall update space `teamb94933220eab48ca921cf26455822d56`, page target `https://bishtiiit.atlassian.net/wiki/x/uIAB`, using the Confluence storage representation. It shall insert or replace a section marked by the report-period idempotency marker, preserve prior dated sections, and retry once after refetching the page version on a conflict. Confluence manager edit access is enforced by the MCP tooling.
- The SMTP adapter shall send the report or approved HTML rendering to the configured recipient list.
- The Teams adapter shall post a concise summary containing counts, highest-severity findings, and report links.
- Delivery adapters shall use bounded timeouts, safe retries where appropriate, and sanitized diagnostics.
- Jira retrieval, validation, normalization, risk evaluation, rendering, and persistence form the data pipeline. A failure in any of these produces pipeline status `Failed` and no report publication. Publication has independent per-destination statuses. Jira is the only required destination; a Jira failure makes publication `Failed`, while Confluence, email, Teams, and the GitHub artifact are optional and may produce `Completed with delivery warnings`. A pipeline-success report is visible in the UI regardless of optional publication failures, and each destination can be retried idempotently.

### 6.5 Web API and frontend

- The Express backend shall expose authenticated endpoints for report listing, report details, finding details, run creation, run status, configuration validation, and health checks.
- API responses shall use typed, versioned contracts and safe error envelopes.
- React shall display current and historical reports, filters by project/sprint/severity/rule, finding details, run progress, empty states, failures, and retry actions.
- The frontend shall never receive integration credentials or perform direct Jira, Confluence, SMTP, or Teams calls.
- User-visible timestamps shall identify the relevant timezone.
- OIDC is the authentication contract. The frontend uses the authorization-code flow with PKCE; the backend validates issuer, audience, signature, expiry, and nonce claims. The stable subject claim is the user identifier. Roles are supplied through a configured group/role claim for `DeliveryManager`, `ReportViewer`, and `Administrator`. Local development may use a documented development identity only when `AUTH_MODE=development`; production rejects that mode.
- `DeliveryManager` and `Administrator` may create runs. Only `Administrator` may change database-backed configuration. All report and finding reads require authentication; administrator diagnostics and audit events require `Administrator`.
- API requests use ISO 8601 UTC timestamps, camelCase JSON, stable enum strings, cursor pagination with a maximum page size of 100, `Idempotency-Key` on run creation, and correlation IDs returned in `X-Correlation-Id`. Validation errors use `400`, authentication `401`, authorization `403`, missing resources `404`, conflicts `409`, upstream failures `502`, and unexpected failures `500`.

### 6.6 Persistence

PostgreSQL 15 shall persist at minimum:

- Report runs and their scope, period, status, timestamps, and correlation identifier.
- Normalized projects, sprints, issues, and issue relationships required for evidence.
- Findings, triggered signals, severity, evidence, recommendations, and source URLs.
- Publication attempts and outcomes for Confluence, email, Teams, and artifacts.
- Sanitized audit events for manual runs, configuration changes, and permission-sensitive actions.

Schema changes shall use versioned migrations. Sensitive values and unnecessary raw payloads shall not be persisted. PostgreSQL identifiers use snake_case; API fields use camelCase. All database timestamps are UTC `timestamptz`. Foreign keys use restrictive deletion for report history, uniqueness is enforced on report scope/period and finding identity, and indexes cover report period/status, project/sprint, finding severity/signal, and publication status. Migrations are owned by the backend and run before the application starts. Reports and findings are retained for 24 months, audit events for 24 months, and sanitized publication diagnostics for 90 days; deletion is an administrator-only, audited operation subject to retention policy.

## 7. Data Model

### ReportRun

`id`, `scope`, `reportPeriodStart`, `reportPeriodEnd`, `timezone`, `status`, `startedAt`, `completedAt`, `correlationId`, `errorCode`, `createdBy`

### Finding

`id`, `reportRunId`, `projectKey`, `sprintId`, `jiraIssueKey`, `ownerDisplayName`, `severity`, `signals`, `evidence`, `recommendation`, `sourceUrl`, `detectedAt`

### RiskSummary

`reportRunId`, `overallSeverity`, `projectCounts`, `sprintCounts`, `severityCounts`, `signalCounts`, `generatedAt`

### PublicationAttempt

`id`, `reportRunId`, `destination`, `status`, `idempotencyKey`, `externalReference`, `attemptedAt`, `sanitizedError`

## 8. API Contract Outline

### `GET /api/v1/reports`

Returns paginated completed and failed report runs, filterable by project, period, status, and severity.

### `GET /api/v1/reports/:reportId`

Returns report metadata, summary counts, publication outcomes, and grouped findings.

### `GET /api/v1/findings/:findingId`

Returns the full sanitized evidence and recommendation for one finding.

### `POST /api/v1/runs`

Starts a manual run. Request body may include `projects` and `sprintId`. Requires authorization and returns a run identifier.

### `GET /api/v1/runs/:runId`

Returns run status, progress stage, sanitized errors, and publication outcomes.

### `POST /api/v1/configuration/validate`

Validates non-secret configuration and secret presence without returning secret values. Requires administrator authorization.

### `GET /api/v1/health`

Returns application and PostgreSQL health without exposing infrastructure secrets.

### API behavior

`/health/live` reports process liveness and `/health/ready` reports database and required configuration readiness. List endpoints return `{ items, nextCursor }`. Run status separates `pipelineStatus` (`Queued`, `Running`, `Succeeded`, `Failed`) from `publicationStatus` (`Pending`, `Succeeded`, `CompletedWithWarnings`, `Failed`). Manual runs are rejected with `409` when an equivalent scope/period is already queued or running, or return the existing run when the idempotency key matches. All errors use `{ error: { code, message, retryable, correlationId, details? } }` without upstream payloads or secrets.

## 9. Non-Functional Requirements

- **Security:** enforce least privilege, validate inputs, redact secrets and personal data, and keep credentials server-side.
- **Reliability:** use idempotency keys for report runs and publication attempts; bound all external calls with timeouts.
- **Performance:** dashboard and paginated report APIs target p95 under 2 seconds for 20 concurrent users; a normal report targets completion within 10 minutes; GitHub Actions jobs have a 20-minute timeout and a maximum concurrency of one per scope.
- **Accessibility:** target WCAG 2.1 AA with keyboard-complete workflows, visible focus, semantic tables/forms, non-color severity indicators, automated axe checks, and a keyboard/screen-reader smoke test for each primary screen.
- **Observability:** emit structured logs, correlation identifiers, run metrics, health status, and sanitized failure diagnostics.
- **Compatibility:** support the versions declared by the constitution: React 18, Vite, Node.js, Express, PostgreSQL 15, and Docker Compose.
- **Maintainability:** keep domain logic independent from Express and React, use TypeScript types at service boundaries, and document migrations and configuration.
- **Browser support:** current and previous major versions of Chrome, Edge, Firefox, and Safari; minimum supported viewport is 320 CSS pixels.
- **Observability:** logs include timestamp, level, service, environment, correlationId, runId, actorId where permitted, event name, duration, and outcome. Alert on readiness failure, repeated pipeline failure, or publication failure for the required Jira destination.

## 10. Edge Cases and Failure Behavior

- No Jira issues or sprints are returned: create a successful empty report with explicit empty-state messaging.
- Jira returns partial pages or rate limits: retry within configured bounds; fail the run if completeness cannot be established.
- An issue has no assignee, due date, sprint, estimate, or update timestamp: preserve the issue and mark the field unavailable.
- A finding matches multiple rules: create one finding with all signals retained.
- A project or sprint is not found: reject that scope with an actionable validation error.
- Confluence, SMTP, or Teams is unavailable: record the optional publication failure, sanitize diagnostics, expose the pipeline-success report, and permit an idempotent destination retry. Jira publication failure makes publication fail.
- The same run is submitted twice: return the existing idempotent run or safely coalesce the requests.
- Database is unavailable: health becomes unhealthy and no successful report publication is claimed.
- A report contains no findings: publish the report with a clear no-risk-findings statement and zero counts.

## 11. Out of Scope for MVP

- Editing Jira issues or sprint data from the web UI.
- Real-time streaming updates from Jira.
- Multiple independent tenants or Atlassian sites.
- Advanced analytics beyond the configured risk rules.
- Automatic remediation or assignment changes.
- Broad Confluence permissions without an approved access decision.

## 12. Success Criteria

The MVP is successful when:

1. An authorized user can view the latest report and inspect sanitized evidence for each finding.
2. A scheduled Monday run and an authorized manual run execute the same report pipeline.
3. Jira data for `SAM1` and `KAN` is normalized, evaluated against all initial rules, and persisted in PostgreSQL 15.
4. The canonical Markdown report is published consistently to configured destinations and uploaded as a workflow artifact; Jira is required and other destinations are independently reported.
5. Repeated runs are idempotent and preserve historical report sections.
6. Missing configuration, upstream errors, invalid data, and delivery failures produce actionable sanitized outcomes.
7. Automated tests cover risk thresholds, integrations, persistence, API authorization, rendering states, and failure behavior.
8. The application passes formatting, linting, TypeScript checks, tests, migration checks, security review, and Markdown validation.

## 13. Approved Assumptions

- The Jira scope is projects `KAN` and `SAM1`; team participation filtering uses assignee, reporter, watcher, or recorded issue participant.
- Jira `Original estimate` is the estimate source for MVP; administrator configuration may identify a tenant-specific field alias.
- The Confluence target is page `uIAB` in space `teamb94933220eab48ca921cf26455822d56`; updates are idempotent by report-period marker.
- The Atlassian token is a user token, not necessarily a service-account token. Confluence manager edit access is enforced through MCP tooling.
- GitHub Actions uses protected environment secrets and invokes the shared report command for both schedule and manual dispatch.
- SMTP uses Gmail with deployment-configured host, port, sender, and recipients; address values remain environment configuration, not committed specification data.
- Teams destination details are deployment configuration. It is optional unless explicitly enabled as required by an administrator.
- The original Python architecture and stale repository references are historical and superseded by the ratified Node.js/Express/TypeScript architecture.

## 14. Traceability

| Requirement area | Governing source |
| --- | --- |
| Technology and architecture | `spec/constitution.md`, sections 2-3 |
| Risk signals and report integrity | `spec/constitution.md`, section 4; `project_spec.md`, sections 3-5 |
| Security and privacy | `spec/constitution.md`, section 5; `project_spec.md`, section 8 |
| Testing and quality gates | `spec/constitution.md`, section 6; `project_spec.md`, section 10 |
| Scheduling and delivery channels | `project_spec.md`, sections 5-6 and 9 |
