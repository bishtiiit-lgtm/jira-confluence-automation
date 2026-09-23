# Specification Clarification Review

**Reviewed documents:** `spec/constitution.md` v1.0.0 and `spec/specification.md` v1.0.0
**Review date:** 2026-09-22
**Reviewer stance:** Senior implementation-readiness review

This review identifies gaps, contradictions, and unclear requirements that should be resolved before production implementation. Items are ordered by implementation and operational risk.

## Executive Assessment

The specification communicates the product intent well, but it is not yet implementation-ready. The largest blockers are the unresolved authentication and authorization model, ambiguous report/run failure semantics, incomplete risk-rule definitions, missing external integration decisions, and the absence of an execution architecture for asynchronous scheduled/manual jobs.

The constitution is the governing document. Where the older `project_spec.md` conflicts with it, the Node.js/Express/TypeScript/PostgreSQL baseline should take precedence and the older Python architecture should be retired or explicitly marked as historical.

## P0 - Must Clarify Before Implementation

### 1. Authentication and identity provider are unspecified

**Evidence:** The specification requires authenticated endpoints and roles (`Delivery Manager`, `Report Viewer`, `Administrator`) but names no identity provider, login mechanism, session strategy, token format, or user directory.

**Why it blocks implementation:** The frontend routes, Express middleware, role checks, audit records, and deployment configuration cannot be implemented safely without an identity contract.

**Clarify:** Choose the identity provider and define OIDC/OAuth flow, frontend session handling, backend token validation, user identifier, role/group claims, session expiry, logout, and local-development authentication.

Out of Scope

### 2. Role permissions conflict with configuration ownership

**Evidence:** Administrators may manage non-secret configuration, thresholds, integrations, and permissions, while configuration is required to come from environment variables or deployment secret stores. The UI also includes editable administration settings.

**Why it is unclear:** It is not defined whether configuration is edited in the UI and persisted in PostgreSQL, edited only through deployment configuration, or displayed as read-only health information.

**Clarify:** Define the source of truth for each setting. A recommended split is deployment-managed secrets and infrastructure settings, database-managed non-secret business settings, and read-only display of environment-managed values. Define which settings require a deployment restart.

Out of scope

### 3. Run execution architecture is missing

**Evidence:** Manual and scheduled runs may be queued, run asynchronously, or execute directly. The UI has `Queued` and `Running` states, but the stack specifies only React, Express, and PostgreSQL; no worker, queue, scheduler, or process ownership is defined.

**Why it blocks implementation:** Long Jira retrieval and publication work should not run inside a normal HTTP request, and scheduled execution needs a durable trigger.

**Clarify:** Select the execution model, such as a separate Node worker with a PostgreSQL-backed job queue, GitHub Actions invoking a worker command, or a managed scheduler. Define retry ownership, worker concurrency, lease/lock behavior, cancellation, and what happens when the worker restarts.

GitHub Actions invoking a worker command

### 4. Success, partial success, and delivery failure semantics conflict

**Evidence:** The constitution says a failed source retrieval or validation step must not produce a successful partial report. The specification lists `Completed with delivery warnings`, says destination failures are recorded, and says the required-destination policy is configurable but never defines which destinations are required.

**Why it is unclear:** A report can be complete while one publication adapter fails, but the final run status and workflow exit code are not defined.

**Clarify:** Define separate statuses for data-pipeline outcome and publication outcome. Specify required versus optional destinations, whether any required failure fails the workflow, whether a report is visible in the UI after publication failure, and the retry behavior for each destination.

Define separate statuses for data-pipeline outcome and publication outcome. Required destinations is JIRA. Report to be visible in the UI after publication failure, and the retry behavior for each destination.

### 5. Authorization model for external systems is incomplete

**Evidence:** The project requires Jira, Confluence, SMTP, Teams, and GitHub integrations, but does not specify exact API scopes, Atlassian account type, Confluence edit permission, GitHub token permissions, or the identity used by the worker.

**Why it blocks deployment:** Least-privilege configuration and access reviews cannot be completed.

**Clarify:** Document the exact required permissions and owner for each integration. Confirm whether the Atlassian token belongs to a service account, how Confluence manager edit access is enforced, and whether GitHub Actions uses repository or environment secrets.

Atlassian token do not belongs to a service account.
Confluence manager edit access is enforced by MCP Tools
GitHub Actions to use environment secrets.

### 6. The team filter is a production prerequisite but remains unresolved

**Evidence:** The filter is represented by `bishtiiit`, while the specification says the exact group, account ID, or project-role mapping must still be confirmed.

**Why it blocks correctness:** The system could include the wrong users or exclude valid work, invalidating every report.

**Clarify:** Record the final Jira group/account/project-role identifier, the filtering field and API, behavior for unassigned issues, and whether the filter applies to assignee, reporter, watcher, or issue participation.

Final Jira group/account/project-role identifier: KAN, SAM1
Filter applies to assignee, reporter, watcher, or issue participation

### 7. Confluence target and update algorithm are unresolved

**Evidence:** The specification requires a stable space/page identifier and historical dated sections, but the target is still a draft URL and no page storage format or idempotency marker is defined.

**Why it blocks implementation:** Confluence updates can overwrite content, duplicate sections, or fail due to page-version conflicts.

**Clarify:** Confirm space key, page ID, page format (storage XHTML or another API representation), insertion location, section heading/marker, page version conflict handling, maximum page size, and whether history is retained indefinitely or archived.

page ID:https://bishtiiit.atlassian.net/wiki/x/uIAB

## P1 - Must Clarify Before Feature Completion

### 8. Risk severity mapping is not defined

**Evidence:** Rules assign `High`, `Medium`, or `Low`, but no rule-to-severity mapping or aggregation algorithm exists.

**Why it matters:** Different implementations will produce different overall risk results.

**Clarify:** Define severity per signal, escalation factors, and overall aggregation. For example, state whether any High finding makes the report High, how multiple Medium signals combine, and whether project/sprint severity is the maximum or a weighted score.

Use industry standards

### 9. Risk-rule boundary semantics are incomplete

The following decisions are missing:

- **Overdue:** Which date and timezone are used? Does exactly one calendar day past due qualify? How are due dates without times interpreted?
- **Blocked:** What exact Jira statuses count as blocked? Does an unresolved blocking link override the issue's own status?
- **Stale:** Which status categories are active? Are weekends and holidays calendar days? What happens when `updated` is missing?
- **Missed commitment:** What is the sprint end boundary, and does an issue completed at the end timestamp count? Is completion based on status category, resolution, or a configured status list?
- **High priority:** Are priority names case-sensitive and configurable across Jira instances?
- **Dependency risk:** Which Jira link types mean `blocks`, and which direction is the predecessor direction?
- **Story-point variance:** Which Jira custom field is story points? How are null, fractional, or changed estimates handled? How is a sprint with zero commitment treated?

Use Industry standards
Jira custom field is story points:Original estimate

### 10. Sprint scope and historical data window are undefined

**Evidence:** The system retrieves active and recently completed sprints, but “recently” is not defined. Manual scope accepts an optional sprint ID, while the UI selector has no endpoint or retention rule.

**Clarify:** Define the lookback duration, supported sprint states, board scope, cross-project sprint behavior, sprint ID validation, and whether a report can evaluate an issue that moved between sprints.

Use Industry standards

### 11. Snapshot consistency is not specified

**Evidence:** Jira issues, sprints, changelogs, and links may change while retrieval is running, but the report must provide reproducible evidence.

**Clarify:** Define the report `asOf` timestamp, whether all API calls use a common cutoff, whether raw/normalized snapshots are retained, and how a report is compared with the previous report.

### 12. Finding identity and deduplication are undefined

**Evidence:** The specification requires one finding for multiple signals but does not define the uniqueness key.

**Clarify:** Define whether uniqueness is `(reportRunId, Jira issue key)`, `(issue, sprint)`, or another key. Define whether the same issue can produce separate project/sprint findings and how signal evidence is merged deterministically.

### 13. Recommendations are required but not generated by a defined rule

**Evidence:** Findings and reports must contain recommendations, but no recommendation catalog, template, owner-selection rule, or fallback text is specified.

**Clarify:** Define recommendation templates per signal, target-owner selection, due-date calculation, and behavior when no owner or target date exists.

### 14. API contracts are only outlines

**Evidence:** Endpoints are named but request/response schemas, pagination format, error codes, authorization requirements, sorting, filter syntax, and concurrency responses are absent.

**Clarify:** Define OpenAPI or equivalent typed contracts, including status codes, validation errors, correlation IDs, cursor/page pagination, maximum page sizes, stable enum values, and idempotency-key headers.

### 15. Database design and lifecycle are incomplete

**Evidence:** Entities and fields are listed, but relationships, constraints, indexes, enum strategy, JSON field structure, migration tool, and retention are missing.

**Clarify:** Define foreign keys, uniqueness constraints, cascade behavior, indexes for report/filter queries, UTC storage rules, encryption requirements, migration ownership, backup/recovery, and retention/deletion policies for reports, findings, audit events, and publication diagnostics.

### 16. Delivery-channel content and recipient policy are unclear

**Evidence:** Markdown is canonical, but email may be Markdown or HTML and Teams is a concise summary. “Consistent” is not defined semantically. Recipient list, sender, Gmail host/port, and Teams destination remain open.

**Clarify:** Define the email format and maximum size, Teams card/message schema and truncation behavior, recipient categories, sender identity, reply-to behavior, retry policy, and whether delivery failures can expose report links to unintended users.

### 17. GitHub Actions behavior is incomplete

**Evidence:** The specification requires a Monday schedule, manual dispatch, artifact upload, and sanitized diagnostics, but does not state the exact cron, workflow inputs, permissions, timeout, concurrency, or secret mapping.

**Clarify:** Specify the exact UTC cron expression, input names and allowed values, concurrency group, job timeout, Node/Docker setup, artifact names and retention, permissions block, environment protection, and failure notification.

### 18. UI behavior has unresolved product decisions

**Evidence:** Screens are described, but there is no design system, browser support, report pagination strategy, sorting definition, confirmation wording, or behavior for stale data.

**Clarify:** Define supported browsers, visual design/accessibility target, default filters, sort order, maximum finding page size, data-refresh policy, stale-report indicator, and whether report filters are shareable through URL parameters.

### 19. Health and observability requirements lack measurable targets

**Evidence:** Health checks, structured logs, metrics, and sanitized diagnostics are required, but no readiness/liveness distinction, log schema, alert thresholds, or retention period is defined.

**Clarify:** Define `/health/live` and `/health/ready` semantics, required log fields, metrics and dashboards, alert conditions, correlation-ID propagation, monitoring owner, and log/diagnostic retention.

### 20. Performance, availability, and scale targets are absent

**Evidence:** The specification says the dashboard should be paginated and long jobs asynchronous but provides no targets.

**Clarify:** Define expected issue volume, concurrent users/runs, dashboard p95 latency, report completion target, API rate-limit budget, acceptable job queue delay, and availability objective.

### 21. Testing strategy is not concrete enough

**Evidence:** Tests are required, but the test runner, database test setup, fixture strategy, coverage threshold, contract testing, browser testing, and CI commands are not named.

**Clarify:** Choose Vitest/Jest, Playwright or equivalent browser testing, migration/test-database strategy, sanitized Jira fixtures, required coverage gates, and which tests run on every pull request versus scheduled CI.

### 22. Docker and environment model is incomplete

**Evidence:** PostgreSQL 15 must run through Docker Compose, but no service name, port, volume, health check, initialization, migration command, or production deployment model is defined.

**Clarify:** Define Compose services, persistent-volume policy, database credentials for local development, health checks, startup ordering, migration execution, backup behavior, and whether Docker is development-only or also used in deployment.

## P2 - Important Clarifications and Cleanup

### 23. Repository and source-of-truth references are inconsistent

The older project specification names the GitHub repository `bishtiiit-lgtm/git-baby-steps-practice`, while the project context identifies `bishtiiit-lgtm/jira-confluence-automation`. Confirm the canonical repository and update stale references.

### 24. The legacy Python architecture should be retired or marked historical

The older specification lists Python modules (`config.py`, `jira_client.py`, and others), while the constitution and current specification require Node.js/Express/TypeScript. Remove the Python module recommendation or label it as superseded to prevent implementation drift.

### 25. Email address and SMTP details need correction and confirmation

The older specification lists `bisht.iiit@gmai.com`, which appears to be a possible typo for a Gmail address. Confirm sender and recipient addresses, but keep actual values out of committed specification files if they are considered operational configuration.

### 26. Report period and comparison behavior are not defined

The UI requires change from the previous report, but the comparison window, baseline selection, handling of missing previous reports, and changed-finding identity are not specified.

### 27. Time storage and display policy is incomplete

Asia/Kolkata is the reporting timezone, but the specification does not explicitly require UTC storage for database timestamps, define DST behavior for future timezone changes, or define the timezone used for Jira due-date and sprint-boundary comparisons.

### 28. Error taxonomy and user messaging are missing

“Actionable errors” and “safe error envelopes” are required, but error codes, retryability, user-safe messages, support details, and administrator diagnostics are not defined.

### 29. Manual run concurrency and backpressure are unspecified

The system does not define whether multiple runs may execute simultaneously, whether one run can block another, maximum concurrent runs, or what happens when GitHub Actions and a user trigger the same scope together.

### 30. Data export and deletion behavior is absent

The specification mentions Markdown downloads and historical reports but does not define export authorization, download expiry, deletion requests, or handling of reports containing personal data.

### 31. UI report access and external-link authorization are unclear

The system must protect reports while linking to Jira and Confluence. Clarify whether links are visible to all application viewers, whether the application proxies any content, and how users without Jira/Confluence access are informed.

### 32. Accessibility requirement needs a testable target

“WCAG 2.1 AA-oriented” is weaker than a conformance requirement. Define the target level, automated checks, keyboard acceptance criteria, screen-reader smoke tests, and ownership for exceptions.

### 33. Browser and device support is missing

Responsive behavior is required, but supported desktop browsers, mobile browsers, minimum viewport, and touch interaction expectations are not defined.

### 34. Versioning and compatibility policy is incomplete

The constitution requires typed, versioned contracts but does not define API version deprecation, database migration compatibility, frontend/backend deployment order, or rollback strategy.

### 35. Security controls are not measurable

The documents require least privilege and dependency review but do not define dependency scanning, secret scanning, TLS requirements, CSRF/cookie policy, rate limiting, audit-log access, or incident response ownership.

### 36. Naming and serialization conventions are undefined

The data model uses camelCase names while PostgreSQL commonly uses snake_case. Define database naming, JSON serialization, enum casing, nullability, and date serialization conventions.

## Recommended Decision Order

Resolve these decisions in this order to minimize rework:

1. Identity provider, roles, and authorization claims.
2. Worker/scheduler/queue architecture and run state machine.
3. Required versus optional delivery destinations and final failure semantics.
4. Jira team identifier, API fields, sprint window, status mappings, and risk thresholds.
5. Confluence page identity and idempotent update algorithm.
6. PostgreSQL schema, retention, migrations, and timestamp policy.
7. API schemas and frontend data-refresh/pagination behavior.
8. GitHub Actions, Docker Compose, testing, observability, and measurable performance targets.

## Suggested Acceptance Gate for Clarifications

Implementation should not begin against the production integrations until P0 items are resolved. At minimum, the next approved version of the specification should contain:

- A role-to-permission matrix and authentication contract.
- A run state machine with retry, concurrency, and publication semantics.
- A final list of required configuration and secrets.
- Exact Jira/Confluence/Teams/SMTP integration parameters and permission scopes.
- Deterministic definitions and severity mappings for every risk rule.
- Versioned API schemas and a PostgreSQL migration/retention plan.
- A test strategy with named tools and CI quality gates.
