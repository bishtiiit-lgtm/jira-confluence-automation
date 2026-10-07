# Architecture Decisions

**Status:** Accepted for MVP implementation planning
**Date:** 2026-10-07
**Governing documents:** `spec/constitution.md` v1.0.0 and `spec/specification.md` v1.1.0

This record captures the approved implementation baseline and the boundaries needed to keep the plan, tasks, and implementation consistent. It describes target decisions; it does not claim that unfinished workflow or integration behavior is already implemented.

## AD-01: Technology and Service Boundaries

Use React 18 with Vite for the frontend, Node.js/Express with TypeScript for the backend, and PostgreSQL 15 as the source of truth. Keep domain logic independent of Express and React. External systems are accessed through typed backend adapters; browser code does not receive integration credentials or call Jira, Confluence, SMTP, or Teams directly.

## AD-02: Scheduled and Manual Execution

GitHub Actions is the MVP scheduler and worker host. The weekly schedule is Monday at `03:30 UTC` (`30 3 * * 1`), corresponding to 09:00 Asia/Kolkata. Manual dispatch accepts optional project and sprint scope. Both trigger paths must invoke the same report command, planned as `npm run report`; the report command is delivered with orchestration work, not this decision-record task. No long-running worker or separate queue service is planned for MVP.

The current `delivery-risk-summary.yml` is only a workflow scaffold and does not yet execute report generation. Workflow inputs, permissions, dispatch credentials, status callback/polling, concurrency, and failure recovery remain implementation work and are not resolved by this record.

## AD-03: Application Identity Scope

Application Authentication and Authorization are deferred from the current implementation phase. The OIDC, session, and role requirements in the product specification describe the eventual application target; they do not authorize adding an identity provider, session model, role middleware, or role-based UI now. The application must not be exposed for production use until the required AuthN/AuthZ scope and access controls are implemented and reviewed.

This deferral does not remove authentication to external services from the integration design. Jira, Confluence, SMTP, Teams, and GitHub credentials remain deployment-managed secrets, are used only by backend/workflow execution, and must not be persisted or logged.

## AD-04: Configuration Ownership

- Deployment environment variables and protected GitHub environment secrets own connection details, deployment-specific identifiers, credentials, and runtime controls.
- Versioned database settings own administrator-managed business thresholds, status/priority mappings, lookback values, and destination enablement once persistence is implemented.
- Each report run uses an immutable snapshot of effective business settings so later edits cannot reinterpret historical reports.
- Local `.env` values are development-only. `.env.example` contains safe names/defaults and no real credentials.

## AD-05: Run, Publication, and Artifact Outcomes

The public run statuses are exactly `Queued`, `Running`, `Completed`, `Completed with delivery warnings`, and `Failed`. Pipeline, per-destination publication, and workflow-artifact outcomes are tracked separately.

- A pipeline failure produces `Failed` and does not publish a successful partial report.
- Confluence is the required report destination. A Confluence publication failure produces run status `Failed`; a pipeline-success report remains persisted and visible for retry.
- Email and Teams are optional destinations. Their failure produces `Completed with delivery warnings` and does not hide the report.
- Canonical Markdown is a GitHub Actions workflow output, not a publication destination. Artifact upload failure records artifact status `Failed`, preserves the persisted report, and makes the workflow exit unsuccessfully.

## AD-06: Approved Integration Assumptions and Open Decisions

Approved assumptions for implementation:

- Jira remains the source system; initial projects are `KAN` and `SAM1`, across issue types, with a 90-day sprint lookback.
- Confluence is the required destination: space `teamb94933220eab48ca921cf26455822d56`, page target `uIAB`, updated with a report-period idempotency marker while preserving dated history.
- Jira credentials use an Atlassian user token, not necessarily a service account. SMTP uses deployment-configured Gmail settings. Teams is optional unless enabled.
- GitHub Actions uses a protected environment for workflow secrets.

The following details remain open and must be resolved before the corresponding integration is production-ready:

- GitHub dispatch credential/permission ownership and callback or polling design.
- The exact Jira participation/team-membership source and behavior when participant data is unavailable.
- The runtime Confluence adapter boundary and how the specified MCP access-control boundary applies to it.
- Concrete SMTP sender/recipient values and the Teams endpoint.

## AD-07: Legacy Material

The Python module recommendations and older repository assumptions in `project_spec.md` and the legacy checklist in `backlog.md` are historical only. The ratified Node.js/Express/React/TypeScript/PostgreSQL architecture and the active tracker in `spec/tasks.md` govern current work.
