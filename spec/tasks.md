# Implementation Tasks: Jira/Confluence Delivery Risk Summary

**Source plan:** `spec/plan.md`
**Specification:** `spec/specification.md` v1.1.0
**Status:** Ready for implementation
**Date:** 2026-09-23

## Task Conventions

Each task has one primary outcome and a completion gate. Tasks within a phase may run in parallel unless a dependency is listed. A task is complete only when its acceptance criteria pass and its changes are documented where they affect operators or users.

## Phase 0: Project Baseline and Architecture

### T0.1 Establish package boundaries

**Depends on:** None

**Work:** Confirm the backend, frontend, shared types, report model, validation, tests, and tooling package boundaries. Remove or mark superseded Python architecture references that could misdirect implementation.

**Acceptance criteria:**

- The package layout is documented and matches the Node.js/Express/React/TypeScript baseline.
- Each package has a clear owner and dependency direction.
- Backend domain packages do not import Express or frontend packages.
- No active implementation instruction recommends the superseded Python architecture.

### T0.2 Configure quality tooling

**Depends on:** T0.1

**Work:** Configure TypeScript, formatting, linting, unit/integration test execution, coverage reporting, and Markdown validation.

**Acceptance criteria:**

- Formatting, linting, type checking, unit tests, and Markdown validation each have documented commands.
- A clean checkout runs every command without manual file edits.
- CI can fail on a type, lint, test, formatting, or Markdown error.
- Test output identifies the failing package and test case.

### T0.3 Provide local PostgreSQL Compose service

**Depends on:** T0.1

**Work:** Add PostgreSQL 15 to Docker Compose with a persistent development volume, health check, startup configuration, and safe local credentials.

**Acceptance criteria:**

- `docker compose up` starts PostgreSQL 15 and reports healthy status.
- The application can connect using documented local environment values.
- Restarting the service preserves data in the local volume.
- Credentials are placeholders or local-only values and are not committed as production secrets.

### T0.4 Define environment configuration

**Depends on:** T0.1

**Work:** Create typed configuration loading, validation, and `.env.example` entries for deployment-managed values, database settings, OIDC, Jira, destinations, retention, and runtime controls.

**Acceptance criteria:**

- Required and optional values are explicitly classified.
- Invalid URLs, timezones, project keys, durations, enum values, and missing required values produce actionable errors.
- `.env.example` contains names and safe placeholders only.
- Secret values are never included in validation errors or logs.

### T0.5 Record architecture decisions

**Depends on:** T0.1, T0.4

**Work:** Document GitHub Actions as scheduler/worker host, OIDC authentication, configuration ownership, run statuses, publication semantics, and approved integration assumptions.

**Acceptance criteria:**

- The decisions agree with `spec/specification.md` and `spec/constitution.md`.
- Scheduled and manual runs reference the same report command.
- Jira is identified as the required publication destination.
- Contradictory legacy decisions are explicitly marked historical.

### Milestone 0 acceptance

- A clean checkout installs dependencies, starts PostgreSQL, runs quality checks, and validates all specification Markdown files.
- The architecture documentation identifies no unresolved implementation blocker for the next phase.

## Phase 1: Domain Model, Database, and Configuration

### T1.1 Design the relational schema

**Depends on:** T0.3, T0.4

**Work:** Define tables and relationships for runs, configuration snapshots, projects, sprints, issues, links, findings, summaries, publications, and audit events.

**Acceptance criteria:**

- PostgreSQL identifiers use snake_case and timestamps use UTC `timestamptz`.
- Foreign keys, restrictive history deletion, uniqueness constraints, and required indexes are defined.
- Finding uniqueness supports `(report_run_id, sprint_id-or-null, jira_issue_key)`.
- Report scope and period cannot create duplicate equivalent runs.

### T1.2 Implement and verify migrations

**Depends on:** T1.1

**Work:** Add versioned migrations and migration checks for apply, rollback or forward recovery, and clean database initialization.

**Acceptance criteria:**

- A disposable PostgreSQL 15 database can be initialized from zero migrations.
- Migrations are repeatable in CI and fail clearly when out of order or incomplete.
- Schema inspection confirms required constraints and indexes.
- Migration status is part of the documented quality gate.

### T1.3 Implement persistence repositories

**Depends on:** T1.2

**Work:** Implement typed repositories for report runs, normalized Jira entities, findings, summaries, publication attempts, and audit events.

**Acceptance criteria:**

- Repository methods use typed inputs/outputs and do not expose database rows directly to the HTTP layer.
- Transactions prevent partially persisted successful reports.
- Duplicate inserts are handled through constraints and idempotent upsert behavior.
- Integration tests cover normal reads/writes, constraint failures, rollback, and pagination indexes.

### T1.4 Implement configuration snapshots and business settings

**Depends on:** T1.2, T0.4

**Work:** Persist versioned non-secret business settings and immutable effective configuration snapshots for each run.

**Acceptance criteria:**

- A run retains the thresholds, mappings, destinations, and lookback values used at execution time.
- Later configuration changes do not change historical report interpretation.
- Configuration updates create an audit event with actor and changed field names, never secret values.
- Concurrent updates cannot silently overwrite a newer configuration version.

### T1.5 Implement retention and deletion controls

**Depends on:** T1.3, T1.4

**Work:** Add retention processing for reports/findings and audit/publication diagnostics, plus administrator-only audited deletion behavior.

**Acceptance criteria:**

- Reports/findings and audit events use the 24-month policy.
- Sanitized publication diagnostics use the 90-day policy.
- Deletion is blocked or audited when a record is still required by report history.
- Retention tests cover boundary timestamps and dry-run reporting.

### Milestone 1 acceptance

- Migrations apply to disposable PostgreSQL 15 and repository tests pass.
- Idempotency, finding uniqueness, UTC storage, retention, and failure-safe transactions are verified.

## Phase 2: Authentication, Authorization, and API Contracts

### T2.1 Implement OIDC login and callback

**Depends on:** T0.4

**Work:** Implement authorization-code flow with PKCE, callback handling, logout, session/token lifecycle, and development-only identity mode.

**Acceptance criteria:**

- Production cannot start with `AUTH_MODE=development`.
- Login validates issuer, audience, signature, expiry, and nonce claims.
- Logout clears the application session and protected routes require authentication.
- No access or refresh token is rendered in the UI, logs, or API response body.

### T2.2 Implement role and permission middleware

**Depends on:** T2.1

**Work:** Map configured identity-provider group claims to the three application roles and enforce route permissions.

**Acceptance criteria:**

- `ReportViewer` can read reports, findings, and run status but cannot create runs or edit settings.
- `DeliveryManager` can create runs but cannot edit administrator configuration or audit access.
- `Administrator` can validate configuration, edit database-backed settings, retry publications, and review permitted diagnostics.
- Unauthorized requests return `401` and authenticated insufficient-role requests return `403` with safe error bodies.

### T2.3 Publish shared API types and enums

**Depends on:** T0.1

**Work:** Define versioned request/response types, status enums, pagination envelopes, error envelopes, and correlation-ID conventions.

**Acceptance criteria:**

- JSON fields use camelCase and timestamps use ISO 8601 UTC.
- Status values exactly match the specification.
- List responses use `{ items, nextCursor }` and enforce a maximum page size of 100.
- API types are consumed by both backend handlers and frontend clients.

### T2.4 Implement safe API error handling and correlation IDs

**Depends on:** T2.2, T2.3

**Work:** Add input validation, error mapping, correlation-ID creation/propagation, redaction, and structured request logging.

**Acceptance criteria:**

- Errors map to the specified `400`, `401`, `403`, `404`, `409`, `502`, and `500` categories.
- Error bodies contain code, safe message, retryability, correlation ID, and optional safe details only.
- Upstream response bodies, authorization headers, tokens, and passwords are excluded.
- `X-Correlation-Id` is returned and included in request/run logs.

### T2.5 Implement health and report/run API routes

**Depends on:** T1.3, T2.4

**Work:** Implement live/readiness, report list/detail, finding detail, run creation/status, configuration validation, and publication retry endpoints.

**Acceptance criteria:**

- `/health/live` checks process liveness only; `/health/ready` checks database and required configuration.
- Report and finding reads are authenticated and paginated where applicable.
- Run creation validates project/sprint scope before dispatch and honors `Idempotency-Key`.
- Equivalent queued/running runs return `409`; matching idempotency requests return the existing run.
- Endpoint integration tests cover authorization, validation, success, and failure cases.

### Milestone 2 acceptance

- API integration tests prove authentication, role boundaries, validation, safe errors, idempotent creation, health semantics, and correlation propagation.

## Phase 3: Jira Adapter and Normalization

### T3.1 Build the typed Jira HTTP client

**Depends on:** T0.4

**Work:** Implement Jira authentication, request construction, pagination, timeouts, bounded retries, rate-limit handling, and normalized upstream errors.

**Acceptance criteria:**

- Every external request has a bounded timeout.
- Retry behavior is limited to safe transient failures and honors rate-limit guidance when available.
- Pagination stops only after the upstream response proves completion.
- Malformed responses and incomplete pages fail the run with sanitized diagnostics.

### T3.2 Retrieve projects, sprints, issues, changelogs, and links

**Depends on:** T3.1

**Work:** Retrieve all issue types for `KAN` and `SAM1`, active/completed sprints within 90 days, required fields, changelogs, estimates, statuses, links, and source URLs.

**Acceptance criteria:**

- Both projects and all issue types are supported.
- The 90-day lookback and optional sprint scope are enforced.
- Required issue fields are requested explicitly and missing optional fields are represented as unavailable.
- Source URLs are stable Jira issue/resource URLs.

### T3.3 Apply participation filtering

**Depends on:** T3.2

**Work:** Filter issues using assignee, reporter, watcher, or recorded participant membership and retain valid unassigned issues in project scope.

**Acceptance criteria:**

- Each included issue has a recorded reason for team/project inclusion.
- Issues outside the selected project or sprint scope are excluded.
- Unassigned in-scope issues remain available for risk evaluation and display as unassigned.
- Fixture tests cover each participation field and an issue with no participant.

### T3.4 Normalize Jira domain records

**Depends on:** T3.2, T3.3

**Work:** Normalize statuses, status categories, priority names, due dates, sprint boundaries, issue-link direction, original estimates, owners, and timestamps.

**Acceptance criteria:**

- Priority matching is case-insensitive while preserving the source display value.
- Date-only due dates are interpreted in Asia/Kolkata.
- Jira `Original estimate` supports null and fractional values without coercing missing data to zero.
- Blocking link direction is deterministic and tested.
- Normalized records contain no credentials, full comments, or unnecessary personal data.

### T3.5 Persist reproducible snapshots

**Depends on:** T1.3, T3.4

**Work:** Capture one run `asOf` timestamp and persist the normalized data required to reproduce findings and evidence.

**Acceptance criteria:**

- Every normalized record for a run is traceable to the run `asOf` timestamp.
- Re-running risk evaluation against the same snapshot produces identical results.
- Snapshot persistence is transactional and cannot be mistaken for a successful report before validation completes.
- Fixture tests prove deterministic serialization and reload behavior.

### Milestone 3 acceptance

- Fixture-backed adapter tests pass for pagination, malformed/partial responses, retries, rate limits, scope validation, timezone conversion, and deterministic normalization.

## Phase 4: Risk Engine and Report Model

### T4.1 Implement rule evaluation framework

**Depends on:** T3.4

**Work:** Create domain-only rule interfaces, evaluation context, evidence model, signal model, and deterministic rule ordering.

**Acceptance criteria:**

- Rules do not import Express, React, database clients, or external HTTP clients.
- Each signal includes rule name, threshold/configuration used, evidence, and source reference.
- Rule execution order is stable across runs.
- Missing required input data produces validation failure where specified rather than an invented risk result.

### T4.2 Implement overdue and blocked rules

**Depends on:** T4.1

**Work:** Implement due-date and blocked-status/dependency evaluation.

**Acceptance criteria:**

- Unresolved issues exactly one calendar day overdue trigger.
- Resolved issues do not trigger overdue.
- Configured blocked statuses and unresolved inward `blocks` links trigger.
- Boundary tests cover due-date timezone, resolution, status, and link direction.

### T4.3 Implement stale and high-priority rules

**Depends on:** T4.1

**Work:** Implement active-issue staleness and case-insensitive priority matching.

**Acceptance criteria:**

- Active issues at five calendar days stale trigger; newer issues do not.
- Weekends and holidays are treated as calendar days.
- Missing `updated` data fails validation instead of triggering stale.
- `High` and `Highest` match case-insensitively; other priorities do not.

### T4.4 Implement commitment, dependency, and variance rules

**Depends on:** T4.1, T3.4

**Work:** Implement sprint completion, missed commitment, predecessor dependency, and original-estimate variance rules.

**Acceptance criteria:**

- Completion exactly at sprint end is on time.
- Incomplete issues at sprint end and sprint completion below 80% are represented correctly.
- A predecessor is risky when overdue, blocked, or stale.
- Null estimates are excluded from arithmetic, fractional values are preserved, and zero commitment is not divided by zero.
- Final-sprint remaining commitment uses the configured final 20% boundary.

### T4.5 Implement severity, deduplication, and aggregation

**Depends on:** T4.2, T4.3, T4.4

**Work:** Merge signals into findings, assign severity, and calculate project, sprint, and overall summaries.

**Acceptance criteria:**

- Findings are unique by `(reportRunId, sprintId-or-null, jiraIssueKey)`.
- Multiple signals produce one finding with deterministic signal order.
- High outranks Medium, Medium outranks Low, and no findings produce `No findings`.
- Summary counts reconcile with stored findings at every level.

### T4.6 Generate recommendations

**Depends on:** T4.5

**Work:** Add recommendation templates, owner selection, and target-date calculation with safe fallbacks.

**Acceptance criteria:**

- Every finding has a recommendation.
- Owner selection uses issue owner when available and a documented fallback otherwise.
- Target dates are derived from rule and report/sprint timing when possible; unavailable dates are explicit.
- Recommendation generation does not expose unnecessary personal data.

### T4.7 Add risk-engine unit and golden-fixture tests

**Depends on:** T4.2, T4.3, T4.4, T4.5, T4.6

**Work:** Cover both sides of every threshold, boundary timestamps, missing fields, multi-signal findings, empty projects, and mixed severities.

**Acceptance criteria:**

- Every initial rule has normal, positive, negative, and boundary tests.
- Golden fixtures produce stable findings, evidence, recommendations, and summaries.
- Tests run without browser, Express, Jira, or PostgreSQL dependencies.
- Test failures identify the rule and boundary that failed.

### Milestone 4 acceptance

- Domain-only risk-engine tests pass and golden fixture output is deterministic.

## Phase 5: Markdown Rendering and Publication

### T5.1 Implement canonical Markdown renderer

**Depends on:** T4.5, T4.6

**Work:** Render report metadata, executive summary, project/sprint summaries, findings, evidence, recommendations, timestamps, and Jira links.

**Acceptance criteria:**

- Output contains all required sections and stable source links.
- Empty reports explicitly state that no findings were detected.
- Mixed severities, missing optional values, multiple projects, and long summaries render without malformed Markdown.
- The same report model always produces byte-stable Markdown.

### T5.2 Implement Confluence publication adapter

**Depends on:** T5.1, T3.1

**Work:** Update the configured storage-format page, preserve dated history, use report-period markers, and handle version conflicts.

**Acceptance criteria:**

- The adapter targets space `teamb94933220eab48ca921cf26455822d56` and page `uIAB`.
- Repeating a report replaces or skips its marked section without duplication.
- Prior dated sections are preserved.
- A version conflict refetches the page and retries once.
- Diagnostics are sanitized and manager edit access is assumed to be enforced by MCP tooling.

### T5.3 Implement email, Teams, and artifact adapters

**Depends on:** T5.1, T0.4

**Work:** Add Gmail SMTP delivery, concise Teams summary, and canonical Markdown GitHub artifact output.

**Acceptance criteria:**

- Each adapter uses bounded timeouts and safe retry behavior.
- Channel content is derived from the canonical report and cannot contradict its counts or severity.
- Recipient, sender, webhook, and authentication values come from deployment configuration.
- Artifact upload includes the canonical Markdown on pipeline success and sanitized diagnostics on failure.

### T5.4 Implement publication outcome persistence

**Depends on:** T1.3, T5.2, T5.3

**Work:** Persist each destination attempt, idempotency key, external reference, outcome, and sanitized diagnostic.

**Acceptance criteria:**

- Jira is classified as required; Confluence, email, Teams, and artifact are independently classified optional unless configured otherwise.
- Optional failures produce `CompletedWithWarnings` and do not hide a pipeline-success report.
- Jira publication failure produces publication `Failed` and a failed workflow outcome.
- Repeating a destination retry does not duplicate an idempotent publication.

### T5.5 Add renderer and adapter integration tests

**Depends on:** T5.2, T5.3, T5.4

**Work:** Test rendering, publication idempotency, conflicts, retries, redaction, and required/optional destination semantics.

**Acceptance criteria:**

- Empty and mixed-severity reports are tested.
- Confluence history and no-duplication behavior are tested.
- Upstream failures, timeouts, malformed responses, and retry exhaustion are tested.
- Tests assert secrets and raw upstream payloads never appear in diagnostics.

### Milestone 5 acceptance

- Renderer and adapter integration tests pass with stable links, correct statuses, sanitized diagnostics, and no duplicate Confluence sections.

## Phase 6: Run Orchestration and GitHub Actions

### T6.1 Implement run state machine

**Depends on:** T1.3, T2.3

**Work:** Implement pipeline and publication status transitions, timestamps, stage progress, and terminal-state rules.

**Acceptance criteria:**

- Pipeline statuses are exactly `Queued`, `Running`, `Succeeded`, and `Failed`.
- Publication statuses are exactly `Pending`, `Succeeded`, `CompletedWithWarnings`, and `Failed`.
- Invalid transitions are rejected and recorded safely.
- Every run records scope, period, `asOf`, correlation ID, start/completion times, and terminal outcome.

### T6.2 Implement shared report command

**Depends on:** T3.5, T4.7, T5.5, T6.1

**Work:** Orchestrate configuration validation, retrieval, normalization, risk evaluation, rendering, persistence, publication, and audit logging.

**Acceptance criteria:**

- Scheduled and manual invocations call the same command and produce equivalent normalized output for equivalent scope/period.
- Failure in retrieval, validation, normalization, risk evaluation, rendering, or persistence produces pipeline `Failed` and no publication.
- Successful pipeline data remains visible when optional publication destinations fail.
- Logs and audit events contain correlation/run IDs without secrets.

### T6.3 Enforce idempotency and concurrency

**Depends on:** T6.1, T6.2

**Work:** Enforce equivalent scope/period uniqueness, idempotency keys, and maximum one concurrent run per scope.

**Acceptance criteria:**

- Duplicate submissions return or reference the existing run as specified.
- Concurrent requests cannot create duplicate findings or publication sections.
- A run that fails can be retried without corrupting the prior report.
- Concurrency conflicts return safe `409` responses.

### T6.4 Create GitHub Actions schedule and dispatch workflow

**Depends on:** T6.2, T6.3

**Work:** Add Monday schedule, manual inputs, protected environment secrets, timeout, concurrency, artifact retention, and failure diagnostics.

**Acceptance criteria:**

- The schedule is `30 3 * * 1` UTC, equivalent to Monday 09:00 Asia/Kolkata.
- Manual dispatch accepts validated project and optional sprint inputs.
- Jobs use the protected environment and never write secrets to artifacts or logs.
- The job timeout is 20 minutes and concurrency is limited per scope.
- Canonical Markdown is uploaded on success; sanitized diagnostics are uploaded on failure.

### Milestone 6 acceptance

- End-to-end scheduled and manual runs produce equivalent results, survive reruns without duplicates, and report pipeline/publication status correctly.

## Phase 7: Frontend Workflow and Accessibility

### T7.1 Implement authenticated application shell

**Depends on:** T2.1, T2.2, T2.3

**Work:** Build navigation, current-user/role display, timezone indicator, sign-out, protected routes, and responsive shell.

**Acceptance criteria:**

- Protected screens cannot be opened without authentication.
- Navigation reflects role permissions without relying only on hidden controls.
- Sign-out removes access to protected data.
- Shell remains usable at the 320px minimum viewport.

### T7.2 Implement dashboard and report views

**Depends on:** T2.5, T5.1

**Work:** Build latest-summary dashboard, report detail, finding detail, filters, pagination, source links, recommendations, and publication outcomes.

**Acceptance criteria:**

- Counts reconcile with API data and filters do not recalculate risk in the browser.
- Report and finding screens show evidence, severity, source links, timestamps, and missing-value labels.
- Filters are server-backed and shareable through URL parameters where supported.
- Pipeline success with optional publication warning is clearly visible.

### T7.3 Implement run and administration views

**Depends on:** T2.5, T6.1

**Work:** Build run form, run status, history, configuration validation, integration health, and permitted retry controls.

**Acceptance criteria:**

- Only Delivery Managers and Administrators can start runs.
- Only Administrators can edit database-backed settings, validate secrets, or inspect restricted diagnostics.
- Run status displays pipeline and publication outcomes separately.
- Confirmation prevents duplicate submission and provides a retry path for allowed failures.

### T7.4 Implement loading, empty, error, and responsive states

**Depends on:** T7.2, T7.3

**Work:** Add layout-preserving loading states, explicit empty states, actionable errors, retry controls, mobile table behavior, and external-link indicators.

**Acceptance criteria:**

- No loading state displays misleading zero counts.
- Empty, failed, partial-failure, and stale-report states explain the next useful action.
- Tables remain readable at narrow widths without hiding severity or action controls.
- Error messages include correlation IDs when appropriate and never expose secrets.

### T7.5 Implement accessibility checks

**Depends on:** T7.1, T7.2, T7.3, T7.4

**Work:** Add semantic HTML, focus management, keyboard workflows, non-color severity indicators, automated axe checks, and assistive-technology smoke coverage.

**Acceptance criteria:**

- Primary workflows are completable with keyboard only.
- Focus is visible and moves predictably after navigation, dialogs, errors, and notifications.
- Severity is communicated by text/icon as well as color.
- Automated accessibility checks pass for primary screens.

### T7.6 Add browser journey tests

**Depends on:** T7.5, T6.4

**Work:** Add Playwright coverage for each role, report inspection, manual run, failure/warning states, retries, mobile layout, and URL filters.

**Acceptance criteria:**

- Viewer, Delivery Manager, and Administrator journeys enforce the permission matrix.
- A report with optional publication warnings remains inspectable.
- Manual run progress and terminal outcomes are covered.
- Tests run against a documented seeded or disposable environment.

### Milestone 7 acceptance

- Browser tests cover primary role workflows, mobile behavior, retries, stale/partial reports, and accessible keyboard operation.

## Phase 8: Operational Hardening and Release

### T8.1 Add metrics, logs, and alerts

**Depends on:** T6.2

**Work:** Implement structured logs, run/destination metrics, health dashboards, alert conditions, and sanitized diagnostics retention.

**Acceptance criteria:**

- Logs include timestamp, level, service, environment, correlation ID, run ID, actor ID where permitted, event, duration, and outcome.
- Metrics distinguish pipeline failures from publication warnings/failures.
- Alerts cover readiness failure, repeated pipeline failure, and required Jira publication failure.
- Diagnostics retention follows the 90-day policy.

### T8.2 Perform security and dependency review

**Depends on:** T2.2, T5.3, T6.4

**Work:** Run dependency, secret, container, and configuration scanning; review external permissions and environment protection.

**Acceptance criteria:**

- No committed secret or secret-bearing artifact is detected.
- Dependencies have no unreviewed release-blocking vulnerability.
- Jira, Confluence, SMTP, Teams, OIDC, and GitHub permissions follow least privilege.
- Protected GitHub environment and deployment secret mappings are documented.

### T8.3 Run performance and resilience tests

**Depends on:** T6.2, T7.2

**Work:** Load test APIs and exercise database, Jira, Confluence, destination, workflow, and recovery failures.

**Acceptance criteria:**

- Dashboard and paginated report APIs meet p95 under 2 seconds for 20 concurrent users.
- Normal report execution completes within 10 minutes under representative data volume.
- Upstream timeout, rate-limit, database outage, and destination retry scenarios produce expected statuses.
- Backup/restore and migration recovery procedures are executed successfully.

### T8.4 Complete operational documentation

**Depends on:** T8.1, T8.2, T8.3

**Work:** Document setup, environment variables, deployment, schedules, retention, monitoring, incident response, backup/restore, and rollback.

**Acceptance criteria:**

- A new operator can deploy from a clean checkout using documented steps.
- Run failure, required Jira publication failure, optional delivery warning, and retry procedures are documented.
- No committed documentation contains real secrets or production-only credentials.
- Rollback and recovery owners are named by role.

### T8.5 Run release quality gate

**Depends on:** T8.1, T8.2, T8.3, T8.4

**Work:** Execute formatting, linting, type checking, unit/integration/browser tests, migration checks, security scans, and Markdown validation.

**Acceptance criteria:**

- All required checks pass from a clean checkout.
- Test artifacts and sanitized diagnostics are retained according to policy.
- No unresolved P0/P1 specification, authorization, security, or data-integrity issue remains.
- Release approval records the tested commit, configuration version, migration version, and rollback procedure.

### Milestone 8 acceptance

- Release candidate passes all quality gates and has a documented rollback and recovery procedure.

## Cross-Phase Definition of Done

Every task must satisfy these conditions where applicable:

- No secret appears in source control, API responses, logs, reports, artifacts, or diagnostics.
- Tests cover the normal path, relevant boundary conditions, and failure behavior.
- User-visible behavior and operator configuration are documented.
- Changes preserve the specification's separate pipeline/publication outcomes.
- Database changes include migrations and rollback/recovery notes.
- The focused test or validation command passes before the task is marked complete.
