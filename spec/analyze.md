# Task Analysis: Jira/Confluence Delivery Risk Summary

**Inputs reviewed:** `spec/specification.md` v1.1.0, `spec/plan.md`, and `spec/tasks.md`
**Analysis date:** 2026-09-23
**Purpose:** Assess implementation complexity, risks, dependencies, and cross-document completeness before engineering begins.

## Executive Assessment

The task breakdown is substantially complete and maps the plan's eight phases to 47 implementation tasks. The dependency direction is mostly coherent: baseline and persistence precede APIs; Jira normalization precedes risk evaluation; risk evaluation precedes rendering and orchestration; browser and release work follow stable contracts.

The four high-impact contract issues identified in the previous analysis are now resolved across the specification, plan, and task breakdown:

1. Confluence is the required report destination; Jira remains the source system.
2. The API and UI use the same public run statuses: `Queued`, `Running`, `Completed`, `Completed with delivery warnings`, and `Failed`.
3. The canonical Markdown file is a GitHub Actions workflow output, with separate artifact status and explicit workflow failure behavior when upload fails.
4. Pipeline-failure behavior is defined under run/report states rather than dashboard visible content.

Implementation remains conditional on the unresolved risks listed below, especially Jira participation semantics and GitHub dispatch details. Authentication and Authorization are intentionally out of scope for this phase and will be planned in a separate decision package rather than treated as active implementation requirements.

The highest-complexity delivery areas are Jira completeness and participation filtering, risk-rule semantics, Confluence idempotent updates, run orchestration/idempotency, and end-to-end operational testing. These areas need early technical spikes and contract fixtures, not only implementation tasks.

## Complexity Scale

- **Low:** bounded implementation with established patterns and limited external uncertainty.
- **Medium:** multiple modules or integration points, but the behavior is reasonably specified.
- **High:** external-system behavior, security-sensitive logic, distributed/idempotency concerns, or unresolved contract risk.

## Task-by-Task Assessment

### Phase 0: Project Baseline and Architecture

| Task | Complexity | Dependencies | Primary risks and assessment |
| --- | --- | --- | --- |
| T0.1 Establish package boundaries | Medium | None | Risk of package boundaries becoming aspirational rather than enforced. Add dependency checks or lint rules; confirm the existing repository structure before moving files. |
| T0.2 Configure quality tooling | Medium | T0.1 | Tool choice, monorepo command orchestration, and CI portability can delay all later work. Pin versions and provide one root validation command. |
| T0.3 Provide local PostgreSQL Compose service | Low | T0.1 | Docker availability and Windows filesystem behavior are the main risks. Add a health-gated startup test and document port collision handling. |
| T0.4 Define environment configuration | High | T0.1 | Configuration ownership is split between environment, database, and GitHub environment secrets. Secret redaction and startup-versus-run validation need explicit schemas and tests. |
| T0.5 Record architecture decisions | Low | T0.1, T0.4 | Low coding complexity, but stale decisions can reappear in implementation. Treat this as a required review artifact and link it from setup documentation. The resolved policy names Confluence as required and the artifact as a workflow output. |

**Phase 0 dependency note:** T0.3 and T0.4 can proceed in parallel after T0.1. T0.5 should be reviewed before database/API contracts are frozen.

### Phase 1: Domain Model, Database, and Configuration

| Task | Complexity | Dependencies | Primary risks and assessment |
| --- | --- | --- | --- |
| T1.1 Design the relational schema | High | T0.3, T0.4 | The model must support immutable snapshots, two status dimensions, publication attempts, retention, pagination, and idempotency. Schema changes after adapters are built will be expensive. Produce an ERD and migration review. |
| T1.2 Implement and verify migrations | Medium | T1.1 | Rollback semantics are not yet defined for destructive migrations. Prefer forward-only migrations plus tested recovery unless the migration tool supports safe down migrations. |
| T1.3 Implement persistence repositories | High | T1.2 | Transaction boundaries across snapshots, findings, summaries, and publications are complex. Avoid exposing ORM/database types to domain and HTTP layers; test transaction failure explicitly. |
| T1.4 Implement configuration snapshots and business settings | High | T1.2, T0.4 | Configuration source-of-truth conflicts remain possible, especially destination enablement and thresholds. Define optimistic versioning and an exact snapshot schema before coding. |
| T1.5 Implement retention and deletion controls | Medium | T1.3, T1.4 | Deletion can break report history, foreign keys, audit requirements, and external links. Define legal/operational exceptions and a dry-run report before enabling deletion. |

**Phase 1 dependency note:** T1.1 needs the final run/publication status model from the contract review. T1.3 and T1.4 can be parallel after T1.2; T1.5 must wait for both.

### Phase 2: API Contracts and Deferred Security Scope

| Task | Complexity | Dependencies | Primary risks and assessment |
| --- | --- | --- | --- |
| T2.1 Deferred: OIDC login and callback | High | None in this phase | Authentication is intentionally deferred and will be planned under a separate scope. No production-ready identity provider, sessions, or PKCE implementation is required for the active backlog. |
| T2.2 Deferred: role and permission middleware | High | T2.1 (deferred) | Authorization is deliberately out of scope for the current phase. This task will be designed later with explicit permission models, auditing, and role-to-claim mapping. |
| T2.3 Publish shared API types and enums | Medium | T0.1 | The public status vocabulary is now resolved, but the values include a human-readable warning label with spaces. Freeze and validate the exact serialized strings so backend and frontend cannot drift. |
| T2.4 Implement safe API error handling and correlation IDs | Medium | T2.3 | Redaction can be bypassed by nested errors or logger serializers. Add structured redaction tests and define correlation-ID trust rules for caller-supplied IDs. |
| T2.5 Implement health and report/run API routes | High | T1.3, T2.4 | This task combines many endpoints, pagination, idempotent dispatch, configuration validation, and publication retry. Split route implementation from API contract tests if schedule pressure becomes high. The manual dispatch mechanism to GitHub Actions is not yet specified but does not require authn/authz in this phase. |

**Phase 2 dependency note:** T2.3 should be completed before T2.4 and the frontend. T2.5 is the active contract work for this phase; Authentication and Authorization remain intentionally deferred and excluded from the milestone scope.

### Phase 3: Jira Adapter and Normalization

| Task | Complexity | Dependencies | Primary risks and assessment |
| --- | --- | --- | --- |
| T3.1 Build the typed Jira HTTP client | High | T0.4 | Jira API version, endpoint selection, pagination limits, authentication method, rate-limit headers, and retry-safe operations are not fully specified. The user token model and exact required scopes still need an integration runbook. |
| T3.2 Retrieve projects, sprints, issues, changelogs, and links | High | T3.1 | This is the largest external data surface and may exceed API rate/timeout budgets. Define field lists, maximum issue volume, pagination strategy, and behavior when changelogs/watchers are unavailable. |
| T3.3 Apply participation filtering | High | T3.2 | The phrase “recorded participant” is not a standard Jira field/API contract, and watcher access may require additional permissions. The team identifiers `KAN` and `SAM1` are project keys, not clearly team identity values. This is a correctness blocker. |
| T3.4 Normalize Jira domain records | High | T3.2, T3.3 | Status categories, original-estimate semantics, sprint fields, link direction, due-date timezone, and missing values affect every downstream rule. Lock normalized schemas with representative tenant fixtures. |
| T3.5 Persist reproducible snapshots | High | T1.3, T3.4 | Snapshot size, retention cost, privacy minimization, and reproducibility versus raw-payload retention are unresolved. Define exactly which normalized records are sufficient and how issue updates are versioned. |

**Phase 3 dependency note:** T3.3 should not be considered implementation-ready until the exact Jira team membership source is confirmed. T3.5 also needs a snapshot size/performance budget.

### Phase 4: Risk Engine and Report Model

| Task | Complexity | Dependencies | Primary risks and assessment |
| --- | --- | --- | --- |
| T4.1 Implement rule evaluation framework | Medium | T3.4 | The framework is manageable, but rule evidence and missing-data behavior need one shared contract. Avoid allowing individual rules to invent inconsistent severity or date handling. |
| T4.2 Implement overdue and blocked rules | Medium | T4.1 | Link direction, resolution semantics, and date-only due-date interpretation are high-correctness risks. Use boundary fixture tables and a single clock/asOf abstraction. |
| T4.3 Implement stale and high-priority rules | Low | T4.1 | The rule logic is bounded, but “active” status configuration and missing updated data must match Jira normalization. Add explicit status-category fixtures. |
| T4.4 Implement commitment, dependency, and variance rules | High | T4.1, T3.4 | This combines sprint boundaries, status completion, dependency recursion, original estimate interpretation, final-sprint timing, and aggregate calculations. Split dependency evaluation from variance if delivery risk is high. |
| T4.5 Implement severity, deduplication, and aggregation | High | T4.2, T4.3, T4.4 | Finding identity with nullable sprint IDs and report-run scoping must match database uniqueness exactly. The specification's “configurable” severity language is narrower than the fixed mapping; clarify which parts are configurable. |
| T4.6 Generate recommendations | Medium | T4.5 | Recommendation ownership and target-date rules remain under-specified. A vague fallback can reduce usefulness and make acceptance subjective. Define a finite template catalog before implementation. |
| T4.7 Add risk-engine unit and golden-fixture tests | Medium | T4.2, T4.3, T4.4, T4.5, T4.6 | Test volume is substantial, and golden fixtures may encode accidental assumptions. Version fixtures and require expected evidence, not only severity assertions. |

**Phase 4 dependency note:** T4.4 is the critical path within the risk engine. T4.7 should begin with fixtures while rule implementations are still being built, but its final gate waits for all rules.

### Phase 5: Markdown Rendering and Publication

| Task | Complexity | Dependencies | Primary risks and assessment |
 | --- | --- | --- | --- |
| T5.1 Implement canonical Markdown renderer | Medium | T4.5, T4.6 | Stable output, escaping, long content, and report comparison are not completely specified. Define a report schema and snapshot fixtures before rendering. |
| T5.2 Implement Confluence publication adapter | High | T5.1, T3.1 | Page ID/short-link resolution, storage-format compatibility, version conflicts, section markers, maximum page size, and permission behavior are external-system risks. The spec says MCP tooling enforces access, but the actual runtime adapter/API boundary is not stated. |
| T5.3 Implement email and Teams adapters | High | T5.1, T0.4 | Gmail authentication, Teams payload/endpoint, recipient policy, and channel size limits are not fixed. Artifact handling is correctly separated into the workflow task, but the two delivery adapters still need independent contract fixtures. |
| T5.4 Implement publication outcome persistence | High | T1.3, T5.2, T5.3 | The required/optional policy is now consistent: Confluence is required and email/Teams are optional. Status aggregation and retry ownership still need explicit persistence tests. |
| T5.5 Add renderer and adapter integration tests | High | T5.2, T5.3, T5.4 | External contract mocks can hide real format/version failures. Add contract fixtures or sandbox tests for Confluence, SMTP, Teams, and GitHub Actions artifact behavior. |

**Phase 5 dependency note:** T5.4 cannot be finalized until the required destination correction and artifact semantics are resolved. T5.2 and T5.3 can be developed in parallel after T5.1.

### Phase 6: Run Orchestration and GitHub Actions

| Task | Complexity | Dependencies | Primary risks and assessment |
 | --- | --- | --- | --- |
| T6.1 Implement run state machine | High | T1.3, T2.3 | The public state vocabulary is now consistent. Terminal transitions, retries, cancellation, artifact status, and scheduled/manual source identity still need explicit rules. |
| T6.2 Implement shared report command | High | T3.5, T4.7, T5.5, T6.1 | This is the primary integration critical path. It must coordinate database transactions, external failures, publication outcomes, retries, and workflow artifact generation without claiming false success. Add a failure matrix before coding. |
| T6.3 Enforce idempotency and concurrency | High | T6.1, T6.2 | GitHub Actions dispatch is asynchronous and may be duplicated by retries or schedule/manual overlap. Database locks, workflow concurrency groups, stale-run recovery, and cancellation behavior are not fully specified. |
| T6.4 Create GitHub Actions schedule and dispatch workflow | High | T6.2, T6.3 | Manual API dispatch authentication, repository permissions, environment protection, input validation, artifact retention, and workflow failure propagation remain incomplete. Artifact upload semantics are now explicit. The 03:30 UTC schedule is correct for the stated timezone only while the timezone offset remains +05:30. |

**Phase 6 dependency note:** T6.2 and T6.3 form the highest-risk critical path. T6.4 should use a stub workflow early to prove dispatch and status callbacks before full orchestration.

### Phase 7: Frontend Workflow and Accessibility

| Task | Complexity | Dependencies | Primary risks and assessment |
 | --- | --- | --- | --- |
| T7.1 Implement authenticated application shell | Medium | T2.1, T2.2, T2.3 | Browser session integration and role-aware routing can diverge from backend authorization. Test direct navigation and expired sessions, not only menu visibility. |
 | T7.2 Implement dashboard and report views | High | T2.5, T5.1 | This is a broad user-facing task covering multiple pages, filters, pagination, evidence, and publication outcomes. API pagination/filter syntax and report comparison behavior are not fully defined. Split dashboard, report detail, and finding detail if parallel delivery is needed. |
 | T7.3 Implement run and administration views | High | T2.5, T6.1 | Manual dispatch feedback, configuration editing, diagnostics access, and publication retry depend on unresolved API/permission semantics. The task should include a threat-model review for admin controls. |
 | T7.4 Implement loading, empty, error, and responsive states | Medium | T7.2, T7.3 | State coverage is easy to miss because the API has two outcome dimensions. Create a state matrix keyed by pipeline status and publication status. |
 | T7.5 Implement accessibility checks | Medium | T7.1, T7.2, T7.3, T7.4 | Automated axe checks do not prove screen-reader usability. The acceptance criterion says assistive-technology smoke coverage but does not name a tool or supported test environment. |
 | T7.6 Add browser journey tests | High | T7.5, T6.4 | End-to-end tests require stable authentication, seeded data, workflow control, and external-service fakes. Define test doubles and environment reset strategy before implementation. |

**Phase 7 dependency note:** T7.6 should not wait for production OIDC or live Jira. Use a test identity provider and contract fakes to keep browser tests deterministic.

### Phase 8: Operational Hardening and Release

| Task | Complexity | Dependencies | Primary risks and assessment |
 | --- | --- | --- | --- |
| T8.1 Add metrics, logs, and alerts | High | T6.2 | Metrics naming, backend choice, dashboard ownership, and alert thresholds are not specified. Without an operational owner, acceptance may become subjective. |
 | T8.2 Perform security and dependency review | Medium | T2.2, T5.3, T6.4 | Scan tooling and vulnerability severity policy are not named. Environment permission review needs a concrete checklist and owner. |
 | T8.3 Run performance and resilience tests | High | T6.2, T7.2 | The targets lack representative issue volume, payload size, database sizing, and concurrency for report jobs. Backup/restore ownership and acceptable recovery objectives are also missing. |
 | T8.4 Complete operational documentation | Medium | T8.1, T8.2, T8.3 | Documentation depends on decisions not yet made, especially dispatch authentication, retention exceptions, alert routing, and rollback ownership. |
 | T8.5 Run release quality gate | Medium | T8.1, T8.2, T8.3, T8.4 | The gate is clear at a high level but has no named CI job or artifact policy. A release can appear green while a required external contract test is absent. |

**Phase 8 dependency note:** T8.1, T8.2, and T8.3 can proceed in parallel after the orchestration path is testable. T8.4 and T8.5 follow their outputs.

## Dependency and Critical-Path Review

### Critical path

`T0.1 -> T0.4 -> T1.1 -> T1.2 -> T1.3 -> T3.5 -> T4.7 -> T5.5 -> T6.2 -> T6.3 -> T6.4 -> T7.6 -> T8.5`

This path is conservative; API and frontend work can proceed in parallel after shared types and route contracts exist. The practical schedule risk is not only task count but the convergence point at T6.2.

### High-risk dependency clusters

- **Identity and dispatch:** T2.1, T2.2, T2.5, T6.4, and T7.3 depend on an unnamed OIDC provider and unspecified GitHub Actions dispatch authentication.
- **Data correctness:** T3.2, T3.3, T3.4, T3.5, and T4.4 depend on Jira fields and permissions that are not fully confirmed.
- **Publication contract:** T5.2, T5.3, T5.4, and T5.5 depend on destination schemas and required Confluence policy; artifact semantics are resolved as workflow behavior.
- **Outcome model:** T2.3, T6.1, T6.2, T7.4, and T7.6 use the resolved public status names but still depend on a detailed state-transition table.
- **Operational proof:** T8.1, T8.3, T8.4, and T8.5 depend on named tools, owners, and measurable recovery expectations.

## Cross-Document Gaps and Contradictions

### P0: Resolve before implementation

1. **Manual GitHub Actions dispatch contract and environment permissions are incomplete.**
   - The API is expected to dispatch a workflow, but the repository permissions, workflow input contract, and status callback/polling mechanism are unspecified.
   - Add a dispatch contract, environment ownership, callback or polling design, duplicate handling, and failure recovery task.

2. **Authentication and Authorization are intentionally deferred and not part of the current phase.**
   - A future auth scope must define the identity provider, issuer, audience, redirect URIs, cookie/session model, group claim, and local test IdP.
   - These concerns are explicitly excluded from the active backlog and are not a blocker for the current implementation phase.

3. **Jira team filter remains semantically unresolved.**
   - `KAN` and `SAM1` are project keys, not necessarily team identifiers.
   - “Recorded participant” is not a defined Jira field/API, and watchers may need separate permission/scopes.
   - Confirm the team membership source, issue participation API, and fallback when watcher/participant data is unavailable.

### P1: Resolve before feature completion

1. **Confluence target identity is incomplete.**
   - The spec includes a short page target and space identifier but no canonical numeric/content page ID or retrieval method.
   - Confirm how `uIAB` resolves at runtime and whether the adapter uses Atlassian REST, MCP, or both. Define page-size and archival behavior.

2. **API contract is still an outline.**
   - Request/response schemas, filter grammar, sorting, cursor encoding, maximum text lengths, idempotency-key replay behavior, and route versioning are not fully defined.
   - Add OpenAPI or equivalent contract artifact before T2.5 and T7.2 are complete.

3. **Recommendation policy is incomplete.**
   - T4.6 requires owner fallback and target dates, but the specification does not define the template catalog, fallback owner, due-date formula, or no-owner behavior.
   - Add a recommendation catalog and examples as a reviewed artifact.

4. **Snapshot and raw-data retention boundaries are unclear.**
   - The spec requires reproducibility but says raw payloads are retained only when justified.
   - Define normalized snapshot columns, whether changelog/link history is retained, size limits, sanitization, and deletion behavior.

5. **Database backup and recovery targets are absent.**
   - T8.3 requires backup/restore testing, but no RPO, RTO, backup frequency, encryption, owner, or production database deployment model is specified.

6. **Operational tooling and ownership are missing.**
   - Metrics, dashboards, alerts, vulnerability scans, and browser accessibility tests have no named tools, destinations, or owners.
   - Define the CI jobs, monitoring destination, notification channel, scan severity policy, and accessibility test tool/environment.

7. **Time-zone scheduling assumption is fragile.**
   - `30 3 * * 1` UTC is correct for Asia/Kolkata, which has no current DST, but the specification should state that the schedule is intentionally UTC and must be reviewed if the reporting timezone changes.

8. **Report comparison is not implemented by any task.**
   - The UI requires change from the previous report, but no task defines baseline selection, finding comparison, changed identity, or missing-baseline behavior.
   - Add a report-diff task and data contract, or remove the comparison requirement from the UI/specification.

9. **Finding status is displayed but not modeled.**
   - Report filters include finding status, yet the data model and tasks only define risk severity and signals.
   - Define statuses such as open/acknowledged/resolved, ownership, update permissions, and whether status is snapshot-specific.

10. **External-link authorization messaging is absent.**
   - The UI links to Jira and Confluence but does not define behavior for users who lack external access.
   - Add a consistent access-denied/help message and test it without proxying external content.

11. **Cancellation and stale-run recovery are absent.**
   - Run states mention queued/running but no cancellation, GitHub Actions cancellation, worker crash, lease expiry, or stale queued-run recovery behavior is defined.
   - Add state transitions and operational recovery tests.

### P2: Improve before release

1. **Repository/source references remain stale in traceability.**
   - The specification still references `project_spec.md` in traceability even though that document is historical and the current repository context differs.
   - Mark the reference historical or replace it with the approved specification/constitution sections.

2. **Configuration edit API is missing.**
   - The UI allows administrators to edit database-backed settings, but the API outline only includes configuration validation, not read/update endpoints.
   - Add `GET`/`PUT` configuration contracts, optimistic versioning, audit behavior, and frontend task coverage.

3. **Publication retry API is missing from the API outline.**
   - Tasks and UI require publication retry, but no route is listed.
   - Add a versioned retry endpoint, destination authorization, idempotency behavior, and response schema.

4. **Artifact and report download APIs are missing.**
   - The UI requires Markdown download and workflow artifact links, but no download endpoint, authorization, content disposition, or retention behavior is defined.

5. **Admin audit-event API/read model is missing.**
   - The admin UI displays audit history, but no endpoint or pagination/filter contract exists.

6. **Teams and SMTP content limits are missing.**
   - The specification says concise Teams summary and email/HTML but defines no maximum sizes, truncation, recipient categories, sender/reply-to policy, or retry classification.

7. **Test data and environment reset strategy are missing.**
   - T7.6 requires seeded/disposable browser environments, but no fixtures, reset command, fake OIDC provider, Jira fake, or destination fake is assigned.

8. **Coverage thresholds and CI merge policy are missing.**
   - Tests are required, but minimum coverage, required PR checks, scheduled security scans, and branch protection are not defined.

9. **Deployment topology is missing.**
   - The spec defines local Docker Compose and GitHub Actions but does not say where the Express API, React frontend, PostgreSQL database, and OIDC callback are deployed for production.

10. **Confluence access enforcement wording may be inaccurate.**
   - The spec says MCP tooling enforces manager edit access, while the implementation plan describes a Confluence adapter. Define whether MCP is an operator/tooling boundary, a runtime dependency, or only an administrative control.

11. **Duplicate observability requirement exists.**
   - Section 9 has two Observability bullets with overlapping but different detail. Consolidate them to avoid divergent implementation and acceptance tests.


## Missing Artifacts to Add

The following artifacts would close the largest gaps before implementation:

1. `spec/decision-log.md` or ADRs for the resolved destination/status/artifact contract, OIDC provider, GitHub dispatch, and cancellation/recovery.
2. `spec/status-machine.md` with state diagrams and legal transitions for pipeline/publication statuses.
3. `spec/openapi.yaml` or generated equivalent for all API routes, including configuration, retry, download, and audit endpoints.
4. `spec/database.md` or ERD with retention, indexes, snapshot strategy, and backup/recovery targets.
5. `spec/recommendations.md` with signal templates, owner fallback, and target-date formulas.
6. `spec/integration-contracts.md` for Jira, Confluence, SMTP, Teams, OIDC, and GitHub Actions permissions and payload limits.
7. `spec/test-strategy.md` defining Vitest/Jest, Playwright, fake services, fixture reset, coverage gates, and CI tiers.
8. `.github/workflows/report.yml` design or a workflow contract documenting schedule, inputs, environment, concurrency, artifacts, and dispatch callbacks.
9. `spec/observability.md` defining metrics, dashboards, alert thresholds, retention, and operational owners.
10. `spec/recovery.md` defining database backup/restore, stale-run recovery, workflow cancellation, RPO, and RTO.

## Recommended Resolution Order

1. Publish the state-transition table for the resolved public status values.
2. Select the OIDC provider and define GitHub Actions dispatch authentication/callback behavior.
3. Confirm Jira team membership/participation APIs and required permissions.
4. Publish the API contract, database model, snapshot policy, recommendation catalog, and finding-status model.
5. Define test doubles, CI gates, observability ownership, deployment topology, and recovery targets.
6. Re-baseline T2.5, T5.4, T6.1-T6.4, T7.2-T7.6, and T8.3-T8.5 against the resolved contracts.

## Overall Readiness

**Status: Conditional readiness.** The task list is detailed enough to start low-risk baseline work (`T0.1` through `T0.3`) and contract spike work, but high-risk implementation should wait for the remaining P0 decisions above. The current plan is structurally sound; the main risk is implementing ambiguous cross-system behavior and then having to revise the database, API, workflow, and UI together.
