# Module 09 Completion Report

## Tracked Files

.gitignore
PROJECT_IDEAS.md
README.md
WEEKLY_STATUS_REPORT_TEMPLATE.md
backlog.md
calculator.py
main.py
project_spec.md

## Backlog Commit History

c62d52d (HEAD -> master, origin/master) Update backlog with status snapshot and completed tasks for clarity
51df84a Add Delivery Risk Summary implementation backlog with phased tasks

## backlog.md Contents

### Delivery Risk Summary Implementation Backlog

**MVP priority:** Jira risk engine + Markdown report
**Execution:** GitHub Actions scheduled and manual runs included in MVP
**Task size:** Implementation-level
**Team filter:** Configurable placeholder until the exact Jira group/account/team mapping is confirmed

**Status snapshot (2026-09-18):** Planning and requirements clarification are complete. The repository currently contains the specification and backlog only; Jira retrieval, risk evaluation, report generation, integrations, CI workflow, and automated tests have not been implemented. Completed checkboxes below reflect only verified repository work.

## Phase 1: Setup

- [ ] Confirm the Jira team filter value for `bishtiiit` and document the final group, account ID, or project-role mapping.
- [ ] Confirm the Confluence space key and stable page ID; replace the draft URL in configuration.
- [ ] Confirm the Gmail SMTP host, port, sender, recipient list, and authentication approach.
- [ ] Confirm the Microsoft Teams destination and webhook or workflow endpoint.
- [ ] Create the Python package structure for configuration, clients, risk rules, rendering, delivery, and tests.
- [ ] Add runtime and development dependencies with pinned or bounded versions.
- [ ] Define non-secret configuration for Jira base URL, project keys `SAM1` and `KAN`, team filter, thresholds, timezone, and report destinations.
- [ ] Define required secret names for Atlassian, SMTP, and Teams credentials without storing values in the repository.
- [ ] Add `.env.example` containing safe placeholder names and no real credentials.
- [x] Verify `.env` and Python caches are excluded from Git; generated reports are not currently produced.
- [ ] Add structured logging with secret and personal-data redaction.
- [x] Define the report data model for metadata, findings, severity, evidence, recommendations, and source links in `project_spec.md`.

## Phase 2: Core Features

- [ ] Implement configuration loading from environment variables and validated defaults.
- [ ] Validate required configuration at startup and produce actionable errors for missing values.
- [ ] Implement an Atlassian API client with token authentication, timeouts, pagination, and retry handling.
- [ ] Retrieve issues for projects `SAM1` and `KAN` across all issue types.
- [ ] Retrieve active and recently completed sprints, sprint dates, commitments, and completion data.
- [ ] Retrieve issue status, priority, assignee, due date, labels, estimates, update timestamps, and source URLs.
- [ ] Retrieve issue links, dependency direction, changelog data, and status history needed for risk evidence.
- [ ] Apply the configurable team filter without hard-coding individual team members.
- [ ] Implement overdue detection for unresolved issues at least one day past due.
- [ ] Implement blocked detection for blocked statuses and unresolved blocking dependencies.
- [ ] Implement stale detection for active issues with no update for at least five calendar days.
- [ ] Implement missed-commitment detection for incomplete sprint issues and completion below 80%.
- [ ] Implement high-priority detection for Highest and High Jira priorities.
- [ ] Implement dependency-risk detection when a blocking predecessor is overdue, blocked, or stale.
- [ ] Implement story-point variance detection using the configured 80% and final-20%-of-sprint thresholds.
- [ ] Assign configurable High, Medium, or Low severity with the triggering rule and evidence.
- [ ] Deduplicate findings that are triggered by multiple related rules while preserving all triggered signals.
- [ ] Calculate project, sprint, and overall risk summaries.
- [ ] Generate Markdown with executive summary, grouped findings, recommended actions, timestamps, and Jira links.
- [ ] Add a command-line entry point that supports a default report run and optional project or sprint scope.
- [ ] Return a non-zero exit code when data retrieval, validation, or report generation fails.

## Phase 3: Integration

### GitHub Actions MVP

- [ ] Create a workflow for Monday 09:00 Asia/Kolkata execution using the correct UTC cron expression.
- [ ] Add `workflow_dispatch` inputs for optional project and sprint selection.
- [ ] Configure Python setup, dependency installation, and the report command in the workflow.
- [ ] Map GitHub encrypted Secrets to the runtime environment without printing secret values.
- [ ] Upload the canonical Markdown report as a workflow artifact.
- [ ] Upload sanitized diagnostics on failure and fail the workflow for incomplete delivery.

### Confluence

- [ ] Implement a Confluence client using the stable space key and page ID.
- [ ] Update the target page with a dated report section while preserving prior report history.
- [ ] Make the page update idempotent so rerunning the same report does not duplicate content.
- [ ] Enforce manager edit access and view-only access for other users as agreed.

### Email

- [ ] Implement an SMTP adapter using Gmail configuration and encrypted runtime secrets.
- [ ] Send the Markdown report or an HTML-rendered equivalent to the approved recipient list.
- [ ] Include report period, overall risk, and a link to the Confluence page when available.
- [ ] Handle SMTP connection, authentication, and delivery failures without exposing credentials.

### Microsoft Teams

- [ ] Implement a Teams webhook or workflow adapter for the confirmed destination.
- [ ] Post a concise risk summary with counts, highest-severity findings, and report links.
- [ ] Handle Teams rate limits and delivery failures with sanitized diagnostics.

## Phase 4: Testing

- [ ] Add configuration tests for valid settings, missing secrets, invalid thresholds, and timezone handling.
- [ ] Add Jira client tests for pagination, retries, API errors, empty results, and normalized fields.
- [ ] Add unit tests for each risk rule and both sides of every threshold boundary.
- [ ] Test overdue, blocked, stale, missed-commitment, high-priority, dependency, and story-point variance cases.
- [ ] Test finding deduplication and severity assignment.
- [ ] Test Markdown rendering with no findings, mixed severities, missing optional fields, and multiple projects.
- [ ] Test CLI success and failure exit codes.
- [ ] Add mocked Confluence tests for page creation/update, history preservation, idempotency, and permissions handling.
- [ ] Add mocked SMTP tests for successful delivery and authentication/connection failures.
- [ ] Add mocked Teams tests for successful posts, malformed responses, and rate limits.
- [ ] Add GitHub Actions validation for scheduled execution, manual inputs, secrets mapping, artifact upload, and failure behavior.
- [ ] Add an end-to-end dry run using sanitized fixture data from both Jira projects.
- [ ] Run linting, formatting, static type checks, and the complete test suite in CI.
- [ ] Verify no secret-bearing files, tokens, passwords, or unnecessary personal data are tracked or logged.

## Phase 5: Documentation

- [ ] Document local setup, supported Python version, dependency installation, and safe `.env` usage.
- [ ] Document every configuration variable, default threshold, severity mapping, and timezone conversion.
- [ ] Document Jira project scope, team-filter configuration, required API permissions, and source fields.
- [ ] Document GitHub Actions setup, encrypted Secret names, scheduled runs, manual dispatch, and artifacts.
- [ ] Document Confluence, Gmail SMTP, and Teams setup and required permissions.
- [ ] Document the Markdown report format and examples for each risk signal.
- [ ] Document retry, failure, partial-delivery, and troubleshooting behavior.
- [ ] Document how to change thresholds and review them with the Delivery Manager.
- [ ] Add a runbook for investigating overdue, blocked, stale, dependency, and estimate-variance findings.
- [ ] Add a release checklist covering credentials, permissions, dry run, report review, and rollback.
- [ ] Record the confirmed open decisions and owner for each remaining integration detail.
