# Implementation Plan: Jira/Confluence Delivery Risk Summary

**Specification:** `spec/specification.md` v1.1.0
**Constitution:** `spec/constitution.md` v1.0.0
**Plan status:** Ready for implementation
**Date:** 2026-09-23

## Delivery Approach

Implement the system in vertical slices. Each phase ends with a usable, testable increment and a milestone gate. The backend owns integration, risk, persistence, and publication behavior; the frontend consumes versioned API contracts. GitHub Actions is the scheduler and worker host for MVP, invoking one shared report command for scheduled and manual runs.

Authentication and Authorization are explicitly out of scope for this implementation phase. Any identity provider, session model, role matrix, or OIDC work is deferred to a separate scope and will not be included in the active backlog unless a later decision reintroduces it.

## Phase 0: Project Baseline and Architecture

**Objective:** Establish the Node.js/TypeScript monorepo baseline and confirm the local development path.

**Work items:**

- Confirm package boundaries for backend, frontend, shared types, report model, and validation.
- Configure TypeScript, formatting, linting, test runner, and Markdown validation.
- Add Docker Compose PostgreSQL 15 with health check, persistent local volume, and documented credentials.
- Create environment configuration schema and `.env.example` with safe placeholders.
- Record the approved architecture, status model, configuration ownership, and integration assumptions.

**Milestone 0:** A clean checkout installs dependencies, starts PostgreSQL, runs type checking and tests, and validates the specification documents.

## Phase 1: Domain Model, Database, and Configuration

**Objective:** Create the durable source of truth for runs, normalized Jira data, findings, publications, and audit events.

**Work items:**

- Define PostgreSQL migrations using UTC `timestamptz`, snake_case identifiers, foreign keys, indexes, and uniqueness constraints.
- Implement repositories for report runs, projects, sprints, issues, links, findings, summaries, publication attempts, and audit events.
- Implement versioned database-backed business settings and immutable configuration snapshots per run.
- Implement environment and secret-presence validation without persisting or logging secret values.
- Add retention and administrator-only deletion jobs for reports, audit events, and publication diagnostics.

**Milestone 1:** Migrations apply and roll back in disposable PostgreSQL 15; repository integration tests prove idempotency, finding uniqueness, UTC storage, retention boundaries, and failure-safe transactions.

## Phase 2: API Contracts and Execution Boundaries

**Objective:** Make the frontend/backend contract stable and the shared run workflow executable without adding identity or authorization work.

**Work items:**

- Publish shared TypeScript request/response types and stable enum values.
- Enforce safe error envelopes, correlation IDs, input validation, cursor pagination, and maximum page size 100.
- Implement `/health/live`, `/health/ready`, report listing/detail, finding detail, run creation/status, configuration validation, and publication retry endpoints.
- Add `Idempotency-Key` handling and `409` conflict behavior for equivalent queued/running runs.
- Define the run, publication, and workflow-artifact state behavior for scheduled and manual executions.
- Keep Authentication and Authorization explicitly out of scope for this phase; defer any OIDC, session, or permission work to a separate decision package.

**Milestone 2:** Integration tests demonstrate contract stability, invalid input handling, idempotent run creation, safe errors, health semantics, and correlation-ID propagation.

## Phase 3: Jira Adapter and Normalization

**Objective:** Retrieve a complete, reproducible Jira snapshot for `KAN` and `SAM1`.

**Work items:**

- Implement typed Jira client pagination, timeouts, bounded retries, rate-limit handling, and normalized upstream errors.
- Retrieve all issue types, active and completed sprints within the 90-day lookback, issue fields, changelogs, links, statuses, estimates, and source URLs.
- Apply participation filtering for assignee, reporter, watcher, and recorded participant; retain valid unassigned issues.
- Normalize status categories, priorities case-insensitively, due dates, sprint boundaries, original estimates, and issue-link direction.
- Capture a run `asOf` timestamp and persist the normalized snapshot needed for reproducible findings.

**Milestone 3:** Fixture-backed adapter tests prove complete pagination, malformed/partial response rejection, retry behavior, rate-limit handling, scope validation, timezone conversion, and deterministic normalized output.

## Phase 4: Risk Engine and Report Model

**Objective:** Calculate deterministic findings and summaries from the normalized snapshot.

**Work items:**

- Implement overdue, blocked, stale, missed commitment, high priority, dependency risk, and story-point variance rules.
- Use Asia/Kolkata for reporting comparisons; interpret date-only due dates as local calendar dates and treat sprint-end completion at the exact boundary as on time.
- Use Jira `Original estimate`; handle missing/fractional values and zero commitment without fabricated percentages.
- Assign High/Medium/Low by the approved severity mapping and aggregate maximum severity to project, sprint, and report levels.
- Deduplicate by `(reportRunId, sprintId-or-null, jiraIssueKey)` and merge signals in fixed rule order.
- Generate recommendation templates with owner fallback and target-date rules.
- Add unit tests for both sides of every threshold, boundary timestamps, missing fields, multiple signals, and empty data.

**Milestone 4:** Risk-engine tests produce stable findings, evidence, recommendations, and summary counts from golden fixtures with no browser or Express dependencies.

## Phase 5: Markdown Rendering and Publication

**Objective:** Produce one canonical report and deliver it with independent destination outcomes.

**Work items:**

- Render executive summary, period/asOf metadata, project and sprint summaries, grouped findings, evidence, recommendations, and stable Jira links as Markdown.
- Implement Confluence storage-format updates for space `teamb94933220eab48ca921cf26455822d56` and page `uIAB`.
- Add report-period idempotency markers, historical dated sections, version-conflict refetch/retry, and sanitized diagnostics.
- Implement SMTP/Gmail and Teams adapters with channel-specific summaries that cannot contradict Markdown.
- Treat Confluence as the required report destination; classify email and Teams failures as warnings and expose pipeline-success reports in the UI.
- Upload the canonical Markdown as a GitHub Actions workflow output after report rendering and persistence. Record artifact upload status separately; an upload failure keeps the report visible but makes the workflow exit unsuccessfully.
- Persist every publication attempt and support idempotent per-destination retry.

**Milestone 5:** Adapter and renderer integration tests prove stable links, empty/mixed-severity rendering, Confluence no-duplication, conflict handling, destination retries, secret redaction, and required-vs-optional status semantics.

## Phase 6: Shared Run Orchestration and GitHub Actions

**Objective:** Execute scheduled and manual runs through the same reliable command.

**Work items:**

- Implement the public run state machine: `Queued`, `Running`, `Completed`, `Completed with delivery warnings`, and `Failed`. Track pipeline, publication, and workflow-artifact details separately while exposing the same final-state labels through the API and UI.
- Orchestrate validation, Jira retrieval, normalization, risk evaluation, rendering, persistence, publication, and audit logging with correlation IDs.
- Make scope/period execution idempotent and enforce maximum one concurrent run per scope.
- Add GitHub Actions Monday schedule at `30 3 * * 1` UTC, manual dispatch inputs for projects and sprint, protected environment secrets, 20-minute timeout, artifact retention, and sanitized diagnostics.
- Ensure workflow exit status reflects pipeline failure, required Confluence publication failure, or artifact upload failure, while optional email and Teams warnings remain visible.

**Milestone 6:** A disposable end-to-end run produces the same result from scheduled and manual inputs, survives reruns without duplicate findings/publication sections, and uploads the canonical artifact or sanitized failure diagnostics.

## Phase 7: Frontend Workflow and Accessibility

**Objective:** Deliver the authenticated dashboard and operational run experience.

**Work items:**

- Build the application shell, dashboard, report detail, finding detail, run form, run status, run history, and administrator health screens.
- Implement server-side pagination, filters, URL-persisted report filters, explicit loading/empty/error/warning states, and external-link treatment.
- Display separate pipeline/publication outcomes and make report visibility after optional delivery failure clear.
- Implement keyboard-complete navigation, focus management, semantic tables/forms, non-color severity indicators, and responsive behavior down to 320px.
- Add browser tests and axe checks for primary screens and role-specific navigation.

**Milestone 7:** Playwright tests cover the primary user journeys for each role, mobile layout, retry states, stale/partial reports, and accessible keyboard operation.

## Phase 8: Operational Hardening and Release

**Objective:** Validate security, performance, recovery, and production readiness.

**Work items:**

- Add structured logs, metrics, health dashboards, alert thresholds, and sanitized diagnostics retention.
- Run dependency, secret, and container scanning; review external permissions and environment protection.
- Load test report APIs to the p95 target of 2 seconds for 20 concurrent users and verify normal report completion within 10 minutes.
- Test database backup/restore, migration compatibility, GitHub Actions concurrency, upstream outages, and destination retry recovery.
- Complete documentation for setup, environment variables, operational recovery, retention, and incident handling.
- Run the full definition-of-done gate: formatting, linting, type checking, unit/integration/browser tests, migrations, security checks, and Markdown validation.

**Milestone 8:** Release candidate passes all quality gates with no unresolved P0/P1 specification or security findings and has a documented rollback and recovery procedure.

## Cross-Phase Acceptance Gates

- No secret appears in source control, API responses, logs, reports, artifacts, or diagnostics.
- Every run has a correlation ID, immutable scope/period, `asOf` timestamp, audit record, and independently recorded publication attempts.
- Every finding has a severity, deterministic signal list, sanitized evidence, recommendation, and source URL.
- Failed retrieval, validation, normalization, risk evaluation, rendering, or persistence never produces a successful report.
- Optional email and Teams failures never erase a pipeline-success report; required Confluence failure is visible and causes the run/workflow to fail. Artifact upload failure leaves the report visible, records artifact status `Failed`, and causes the workflow to exit unsuccessfully.
- Historical reports remain readable after configuration changes and are retained according to policy.

## Suggested Delivery Order

1. Phases 0-2: baseline, persistence, identity, and contracts.
2. Phases 3-5: Jira snapshot, risk engine, rendering, and publication.
3. Phases 6-7: orchestration, GitHub Actions, and frontend workflows.
4. Phase 8: operational hardening and release readiness.
