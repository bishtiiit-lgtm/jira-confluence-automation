# Delivery Risk Summary Implementation Backlog

**MVP priority:** Jira risk engine + Markdown report
**Execution:** GitHub Actions scheduled and manual runs included in MVP
**Task size:** Implementation-level
**Team filter:** Configurable placeholder until the exact Jira group/account/team mapping is confirmed

**Status snapshot (2026-09-18):** Planning and requirements clarification are complete. The repository currently contains the specification and backlog only; Jira retrieval, risk evaluation, report generation, integrations, CI workflow, and automated tests have not been implemented. Completed checkboxes below reflect only verified repository work.

## Phase 1: Setup

- [ ] Confirm the Jira team filter value for `bishtiiit` and document the final group, account ID, or project-role mapping. — GitHub issue #3 — MCP
- [ ] Confirm the Confluence space key and stable page ID; replace the draft URL in configuration. — GitHub issue #4 — MCP
- [ ] Confirm the Gmail SMTP host, port, sender, recipient list, and authentication approach. — GitHub issue #5 — custom skill
- [ ] Confirm the Microsoft Teams destination and webhook or workflow endpoint. — GitHub issue #6 — custom skill
- [ ] Create the Python package structure for configuration, clients, risk rules, rendering, delivery, and tests. — GitHub issue #7 — custom skill
- [ ] Add runtime and development dependencies with pinned or bounded versions. — GitHub issue #8 — custom skill
- [ ] Define non-secret configuration for Jira base URL, project keys `SAM1` and `KAN`, team filter, thresholds, timezone, and report destinations. — GitHub issue #9 — custom skill
- [ ] Define required secret names for Atlassian, SMTP, and Teams credentials without storing values in the repository. — GitHub issue #1 — custom skill
- [ ] Add `.env.example` containing safe placeholder names and no real credentials. — GitHub issue #10 — custom skill
- [x] Verify `.env` and Python caches are excluded from Git; generated reports are not currently produced. — custom skill
- [ ] Add structured logging with secret and personal-data redaction. — GitHub issue #2 — custom skill
- [x] Define the report data model for metadata, findings, severity, evidence, recommendations, and source links in `project_spec.md`. — custom skill

## Phase 2: Core Features

- [ ] Implement configuration loading from environment variables and validated defaults. — custom skill
- [ ] Validate required configuration at startup and produce actionable errors for missing values. — custom skill
- [ ] Implement an Atlassian API client with token authentication, timeouts, pagination, and retry handling. — MCP
- [ ] Retrieve issues for projects `SAM1` and `KAN` across all issue types. — MCP
- [ ] Retrieve active and recently completed sprints, sprint dates, commitments, and completion data. — MCP
- [ ] Retrieve issue status, priority, assignee, due date, labels, estimates, update timestamps, and source URLs. — MCP
- [ ] Retrieve issue links, dependency direction, changelog data, and status history needed for risk evidence. — MCP
- [ ] Apply the configurable team filter without hard-coding individual team members. — MCP
- [ ] Implement overdue detection for unresolved issues at least one day past due. — custom skill
- [ ] Implement blocked detection for blocked statuses and unresolved blocking dependencies. — custom skill
- [ ] Implement stale detection for active issues with no update for at least five calendar days. — custom skill
- [ ] Implement missed-commitment detection for incomplete sprint issues and completion below 80%. — custom skill
- [ ] Implement high-priority detection for Highest and High Jira priorities. — custom skill
- [ ] Implement dependency-risk detection when a blocking predecessor is overdue, blocked, or stale. — custom skill
- [ ] Implement story-point variance detection using the configured 80% and final-20%-of-sprint thresholds. — custom skill
- [ ] Assign configurable High, Medium, or Low severity with the triggering rule and evidence. — custom skill
- [ ] Deduplicate findings that are triggered by multiple related rules while preserving all triggered signals. — custom skill
- [ ] Calculate project, sprint, and overall risk summaries. — custom skill
- [ ] Generate Markdown with executive summary, grouped findings, recommended actions, timestamps, and Jira links. — custom skill
- [ ] Add a command-line entry point that supports a default report run and optional project or sprint scope. — custom skill
- [ ] Return a non-zero exit code when data retrieval, validation, or report generation fails. — custom skill

## Phase 3: Integration

### GitHub Actions MVP

- [ ] Create a workflow for Monday 09:00 Asia/Kolkata execution using the correct UTC cron expression. — custom skill
- [ ] Add `workflow_dispatch` inputs for optional project and sprint selection. — custom skill
- [ ] Configure Python setup, dependency installation, and the report command in the workflow. — custom skill
- [ ] Map GitHub encrypted Secrets to the runtime environment without printing secret values. — custom skill
- [ ] Upload the canonical Markdown report as a workflow artifact. — custom skill
- [ ] Upload sanitized diagnostics on failure and fail the workflow for incomplete delivery. — custom skill

### Confluence

- [ ] Implement a Confluence client using the stable space key and page ID. — MCP
- [ ] Update the target page with a dated report section while preserving prior report history. — MCP
- [ ] Make the page update idempotent so rerunning the same report does not duplicate content. — custom skill
- [ ] Enforce manager edit access and view-only access for other users as agreed. — MCP

### Email

- [ ] Implement an SMTP adapter using Gmail configuration and encrypted runtime secrets. — custom skill
- [ ] Send the Markdown report or an HTML-rendered equivalent to the approved recipient list. — custom skill
- [ ] Include report period, overall risk, and a link to the Confluence page when available. — custom skill
- [ ] Handle SMTP connection, authentication, and delivery failures without exposing credentials. — custom skill

### Microsoft Teams

- [ ] Implement a Teams webhook or workflow adapter for the confirmed destination. — custom skill
- [ ] Post a concise risk summary with counts, highest-severity findings, and report links. — custom skill
- [ ] Handle Teams rate limits and delivery failures with sanitized diagnostics. — custom skill

## Phase 4: Testing

- [ ] Add configuration tests for valid settings, missing secrets, invalid thresholds, and timezone handling. — custom skill
- [ ] Add Jira client tests for pagination, retries, API errors, empty results, and normalized fields. — custom skill
- [ ] Add unit tests for each risk rule and both sides of every threshold boundary. — custom skill
- [ ] Test overdue, blocked, stale, missed-commitment, high-priority, dependency, and story-point variance cases. — custom skill
- [ ] Test finding deduplication and severity assignment. — custom skill
- [ ] Test Markdown rendering with no findings, mixed severities, missing optional fields, and multiple projects. — custom skill
- [ ] Test CLI success and failure exit codes. — custom skill
- [ ] Add mocked Confluence tests for page creation/update, history preservation, idempotency, and permissions handling. — custom skill
- [ ] Add mocked SMTP tests for successful delivery and authentication/connection failures. — custom skill
- [ ] Add mocked Teams tests for successful posts, malformed responses, and rate limits. — custom skill
- [ ] Add GitHub Actions validation for scheduled execution, manual inputs, secrets mapping, artifact upload, and failure behavior. — custom skill
- [ ] Add an end-to-end dry run using sanitized fixture data from both Jira projects. — custom skill
- [ ] Run linting, formatting, static type checks, and the complete test suite in CI. — custom skill
- [ ] Verify no secret-bearing files, tokens, passwords, or unnecessary personal data are tracked or logged. — custom skill

## Phase 5: Documentation

- [ ] Document local setup, supported Python version, dependency installation, and safe `.env` usage. — custom skill
- [ ] Document every configuration variable, default threshold, severity mapping, and timezone conversion. — custom skill
- [ ] Document Jira project scope, team-filter configuration, required API permissions, and source fields. — custom skill
- [ ] Document GitHub Actions setup, encrypted Secret names, scheduled runs, manual dispatch, and artifacts. — custom skill
- [ ] Document Confluence, Gmail SMTP, and Teams setup and required permissions. — custom skill
- [ ] Document the Markdown report format and examples for each risk signal. — custom skill
- [ ] Document retry, failure, partial-delivery, and troubleshooting behavior. — custom skill
- [ ] Document how to change thresholds and review them with the Delivery Manager. — custom skill
- [ ] Add a runbook for investigating overdue, blocked, stale, dependency, and estimate-variance findings. — custom skill
- [ ] Add a release checklist covering credentials, permissions, dry run, report review, and rollback. — custom skill
- [ ] Record the confirmed open decisions and owner for each remaining integration detail. — custom skill
