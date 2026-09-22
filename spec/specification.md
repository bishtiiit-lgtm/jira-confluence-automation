# Feature Specification: Jira/Confluence Delivery Risk Summary

**Status:** Draft
**Version:** 1.0.0
**Date:** 2026-09-22
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

Can manage non-secret configuration, integration settings, permissions, thresholds, and operational controls. Administrator actions must be authenticated, authorized, audited, and protected from accidental disclosure.

### Automation Worker

Runs scheduled or manually requested report jobs using deployment-managed credentials. It can retrieve external data, persist normalized results, publish configured outputs, and record sanitized audit events.

## 4. User Scenarios and Acceptance Tests

### P1: View the latest delivery-risk report

**Given** a completed report exists for the configured scope and period, **when** an authorized user opens the dashboard, **then** the system displays the overall risk level, project and sprint summaries, finding counts by severity and rule, generation time in Asia/Kolkata, and links to the detailed report and Jira sources.

**Acceptance tests:**

- The dashboard identifies the report period, projects, sprints, and run outcome.
- High, Medium, and Low counts are visible and reconcile with the stored findings.
- Missing optional owner, sprint, or due-date values do not break rendering.
- The UI displays a clear empty state when no completed report exists.

### P1: Generate a report manually

**Given** an authorized user selects an optional project and sprint scope, **when** the user starts a report run, **then** the backend validates the scope, queues or executes one idempotent run, and exposes progress and final outcome.

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
- Project summary for `SAM1` and `KAN`, including issue count, sprint completion, committed points, completed points, and risk level.
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
- Required non-secret settings shall include Jira base URL, project keys, team filter, reporting timezone, risk thresholds, Confluence space/page identifiers, report recipients, and delivery toggles.
- Required secrets shall include Atlassian authentication, SMTP authentication, and Teams webhook or workflow credentials as applicable.
- The backend shall fail startup or fail the requested run with actionable errors when required configuration is missing or invalid.
- Thresholds shall support the initial defaults: stale at 5 calendar days, sprint completion at 80%, and final-sprint remaining commitment at 20%.

### 6.2 Jira retrieval and normalization

- The Jira adapter shall authenticate using deployment-managed credentials.
- It shall retrieve all issue types in `SAM1` and `KAN`, active and recently completed sprints, issue fields, changelogs, issue links, estimates, statuses, and source URLs.
- It shall support pagination, bounded timeouts, safe retries, rate-limit handling, and normalized error reporting.
- It shall apply the configured team filter represented by `bishtiiit` after the exact group, account ID, or project-role mapping is confirmed.
- It shall normalize external responses into typed domain records before risk evaluation.

### 6.3 Risk evaluation

The risk engine shall evaluate each configured rule:

- **Overdue:** unresolved issue is at least one day past its due date.
- **Blocked:** issue has a blocked status or an unresolved blocking dependency.
- **Stale:** active issue has not been updated for at least five calendar days.
- **Missed commitment:** issue is incomplete at sprint end, or sprint completion is below 80%.
- **High priority:** issue priority is `Highest` or `High`.
- **Dependency risk:** a blocking predecessor is overdue, blocked, or stale.
- **Story-point variance:** completed points are below 80% of committed points, or remaining points exceed 20% of original commitment during the final 20% of the sprint.

The engine shall assign configurable `High`, `Medium`, or `Low` severity, retain all triggering signals, deduplicate related findings, and calculate project, sprint, and overall summaries.

### 6.4 Reports and publication

- Markdown shall be the canonical report format.
- The report shall include generation timestamp, reporting period, overall risk, project and sprint summaries, grouped findings, severity, evidence, recommendations, and Jira source links.
- The Confluence adapter shall update a configured stable page and preserve dated report history.
- The SMTP adapter shall send the report or approved HTML rendering to the configured recipient list.
- The Teams adapter shall post a concise summary containing counts, highest-severity findings, and report links.
- Delivery adapters shall use bounded timeouts, safe retries where appropriate, and sanitized diagnostics.
- A report shall not be marked successfully published when required retrieval, validation, rendering, or configured delivery steps fail.

### 6.5 Web API and frontend

- The Express backend shall expose authenticated endpoints for report listing, report details, finding details, run creation, run status, configuration validation, and health checks.
- API responses shall use typed, versioned contracts and safe error envelopes.
- React shall display current and historical reports, filters by project/sprint/severity/rule, finding details, run progress, empty states, failures, and retry actions.
- The frontend shall never receive integration credentials or perform direct Jira, Confluence, SMTP, or Teams calls.
- User-visible timestamps shall identify the relevant timezone.

### 6.6 Persistence

PostgreSQL 15 shall persist at minimum:

- Report runs and their scope, period, status, timestamps, and correlation identifier.
- Normalized projects, sprints, issues, and issue relationships required for evidence.
- Findings, triggered signals, severity, evidence, recommendations, and source URLs.
- Publication attempts and outcomes for Confluence, email, Teams, and artifacts.
- Sanitized audit events for manual runs, configuration changes, and permission-sensitive actions.

Schema changes shall use versioned migrations. Sensitive values and unnecessary raw payloads shall not be persisted.

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

## 9. Non-Functional Requirements

- **Security:** enforce least privilege, validate inputs, redact secrets and personal data, and keep credentials server-side.
- **Reliability:** use idempotency keys for report runs and publication attempts; bound all external calls with timeouts.
- **Performance:** the dashboard should return a paginated report view without loading all historical findings; long report jobs shall run asynchronously when needed.
- **Accessibility:** meet WCAG 2.1 AA-oriented keyboard, focus, contrast, and semantic HTML expectations.
- **Observability:** emit structured logs, correlation identifiers, run metrics, health status, and sanitized failure diagnostics.
- **Compatibility:** support the versions declared by the constitution: React 18, Vite, Node.js, Express, PostgreSQL 15, and Docker Compose.
- **Maintainability:** keep domain logic independent from Express and React, use TypeScript types at service boundaries, and document migrations and configuration.

## 10. Edge Cases and Failure Behavior

- No Jira issues or sprints are returned: create a successful empty report with explicit empty-state messaging.
- Jira returns partial pages or rate limits: retry within configured bounds; fail the run if completeness cannot be established.
- An issue has no assignee, due date, sprint, estimate, or update timestamp: preserve the issue and mark the field unavailable.
- A finding matches multiple rules: create one finding with all signals retained.
- A project or sprint is not found: reject that scope with an actionable validation error.
- Confluence, SMTP, or Teams is unavailable: record the publication failure, sanitize diagnostics, and apply the configured required-destination policy.
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
4. The canonical Markdown report is published consistently to configured destinations and uploaded as a workflow artifact.
5. Repeated runs are idempotent and preserve historical report sections.
6. Missing configuration, upstream errors, invalid data, and delivery failures produce actionable sanitized outcomes.
7. Automated tests cover risk thresholds, integrations, persistence, API authorization, rendering states, and failure behavior.
8. The application passes formatting, linting, TypeScript checks, tests, migration checks, security review, and Markdown validation.

## 13. Open Decisions and Assumptions

- Confirm the exact Jira team identifier represented by `bishtiiit` before production use.
- Resolve the Confluence draft URL to a stable space key and page ID.
- Confirm the Teams destination and webhook or workflow endpoint.
- Confirm Gmail SMTP host, port, sender, recipient list, and authentication approach. Credentials remain deployment secrets.
- Confirm the final permission model: the Delivery Manager and administrators may edit where required; other users are view-only.
- The original business specification describes Python modules, but this SpecKit specification follows the ratified constitution and defines the implementation using React 18/Vite, Node.js/Express, TypeScript, PostgreSQL 15, and Docker Compose.

## 14. Traceability

| Requirement area | Governing source |
| --- | --- |
| Technology and architecture | `spec/constitution.md`, sections 2-3 |
| Risk signals and report integrity | `spec/constitution.md`, section 4; `project_spec.md`, sections 3-5 |
| Security and privacy | `spec/constitution.md`, section 5; `project_spec.md`, section 8 |
| Testing and quality gates | `spec/constitution.md`, section 6; `project_spec.md`, section 10 |
| Scheduling and delivery channels | `project_spec.md`, sections 5-6 and 9 |
