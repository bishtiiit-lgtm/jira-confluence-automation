# Delivery Risk Summary - Technical Specification

> Historical archival note: this document reflects the earlier Python implementation approach and is superseded by the ratified Node.js/Express/React/PostgreSQL architecture in `spec/constitution.md` and `spec/specification.md`. It remains for historical traceability only and must not guide active implementation.

## 1. Overview

Build a Python automation that gathers delivery signals from Jira and publishes a weekly Delivery Risk Summary for a Delivery Manager overseeing five people working on product development. The first implementation targets the Jira site `https://bishtiiit.atlassian.net`, projects `SAM1` and `KAN`, and all issue types.

The system supports both a scheduled run and an on-demand run from GitHub. It produces the same normalized report for Confluence, email, Microsoft Teams, and a downloadable artifact.

## 2. Goals

- Identify delivery risks without manual Jira review.
- Explain why each item, sprint, or project is at risk.
- Publish a consistent report every Monday at 09:00 Asia/Kolkata.
- Allow an authorized user to trigger an on-demand report in GitHub.
- Preserve enough source links and evidence for each finding.

## 3. Risk Signals and Initial Defaults

All thresholds must be configuration values and reviewed with the Delivery Manager.

- **Overdue:** unresolved issue past its due date by at least one day.
- **Blocked:** issue is in a blocked status or has an unresolved blocking dependency.
- **Stale:** no issue update for 5 or more calendar days while the issue is active.
- **Missed commitment:** incomplete issue at sprint end, or sprint scope completion below 80%.
- **High priority:** Jira priority is Highest or High.
- **Dependency risk:** an unresolved blocking predecessor is overdue, blocked, or stale.
- **Story-point variance:** completed points are below 80% of committed points, or remaining points exceed 20% of the original sprint commitment in the final 20% of the sprint.

Each finding includes a severity of `High`, `Medium`, or `Low`, the triggered rule, Jira key, owner, project, sprint, and source URL.

## 4. Report Structure

- Executive summary with overall risk level and key changes since the previous run.
- Risk summary grouped by project and sprint.
- Overdue, blocked, stale, dependency, priority, and estimate-variance findings.
- Recommended actions with owner and target date when available.
- Jira source links and generation timestamp.

## 5. Functional Requirements

- Retrieve Jira projects `SAM1` and `KAN`, all issue types, active and recently completed sprints, issues, changelogs, links, estimates, and statuses.
- Filter or identify the product development team using the Jira identity/group value `bishtiiit`; confirm the exact Jira group, account ID, or project-role mapping before production use.
- Calculate each configured risk signal and deduplicate related findings.
- Generate Markdown as the canonical report format.
- Create or update the configured Confluence page while preserving dated report history.
- Send the report through SMTP to a configured recipient list.
- Post the report or a concise summary to Microsoft Teams.
- Upload the Markdown artifact to the GitHub Actions workflow run.
- Fail clearly when a source or destination is unavailable and retain diagnostic logs without secrets.

## 6. Integrations

- **Jira/Confluence:** Atlassian REST APIs using token authentication.
- **Confluence target:** the provided Atlassian draft URL is an initial target; resolve it to a stable space key and page ID before deployment.
- **GitHub:** repository `https://github.com/bishtiiit-lgtm/git-baby-steps-practice` with GitHub Actions for scheduling and manual dispatch.
- **Email:** SMTP server configured through secrets and environment variables.
- **Chat:** Microsoft Teams webhook or workflow endpoint configured through secrets.

## 7. Architecture

1. GitHub Actions starts the scheduled or manually dispatched workflow.
2. Configuration loader reads non-secret settings and validates required secrets.
3. Jira client retrieves and normalizes issues, sprints, changelogs, links, and estimates.
4. Risk engine evaluates configurable rules and assigns severity and evidence.
5. Report renderer creates Markdown plus channel-specific summaries.
6. Delivery adapters update Confluence, send SMTP email, post to Teams, and upload an artifact.
7. The workflow publishes success/failure metrics and sanitized logs.

Suggested Python modules: `config.py`, `jira_client.py`, `risk_engine.py`, `report_renderer.py`, `confluence_client.py`, `email_sender.py`, `teams_sender.py`, and `main.py`.

## 8. Configuration and Security

- Local development may use `.env`; it must remain ignored by Git.
- GitHub Actions must use GitHub encrypted Secrets, not a committed `.env` file.
- Required secrets include Atlassian token, SMTP credentials, and Teams webhook/workflow secret.
- Store Jira and Confluence base URLs, project keys, schedule, thresholds, recipients, and target IDs as non-secret configuration.
- Do not include tokens, passwords, full issue comments, or unnecessary personal data in reports or logs.
- Access should be restricted to intended Jira/Confluence users and the configured report recipients; the current request for everyone to view/edit requires explicit confirmation before enabling broad permissions.

## 9. Workflow

- Schedule: every Monday at 09:00 Asia/Kolkata using a GitHub Actions cron expression converted to UTC.
- Manual execution: GitHub Actions `workflow_dispatch`, with optional project and sprint inputs.
- On failure: do not publish partial results; upload sanitized diagnostics and return a failed workflow status.
- On success: publish all configured outputs and upload the canonical Markdown report.

## 10. Acceptance Criteria

- A scheduled run executes at the agreed Monday time in Asia/Kolkata.
- A manual GitHub run can generate a report for the selected scope.
- Every risk finding includes a rule, severity, Jira key, evidence, and source link.
- Confluence, SMTP email, Teams, and the GitHub artifact receive consistent report content.
- Missing or invalid credentials produce an actionable error without exposing secrets.
- Unit tests cover each risk rule, threshold boundaries, empty Jira results, API failures, and report rendering.
- Integration tests cover Jira retrieval and each delivery adapter using mocked services.
- No secret-bearing files or credentials are tracked by Git.

## 11. Open Decisions Before Implementation

- Confirm the exact Jira team identifier represented by `bishtiiit`.
Here is the link: https://home.atlassian.com/o/4db0f1dd-6e98-45fe-b93d-f01ef213ef81/people/team/b9493322-0eab-48ca-921c-f26455822d56?cloudId=69f33880-526c-4067-bbfa-4909cf7ec9d9
- Confirm the Confluence space key and stable page ID; the supplied URL is a draft URL.
Here is the link: https://bishtiiit.atlassian.net/wiki/spaces/teamb94933220eab48ca921cf26455822d56/overview
- SMTP provider is Gmail, sender address:bisht.iiit@gmai.com, recipient list:bisht.iiit@gmai.com, and Teams destination.
- All users except me can only view.
- Review and approve the default risk thresholds and severity mapping. All good.
