# Jira/Confluence Automation Constitution

**Version:** 1.0.0
**Status:** Ratified
**Date:** 2026-09-22

This constitution defines the non-negotiable engineering principles for the Jira/Confluence Delivery Risk Summary application. It governs implementation, review, testing, deployment, and future changes.

## 1. Product Purpose

The system shall provide a dependable Delivery Risk Summary by retrieving delivery data from Jira, evaluating configurable risk signals, rendering a canonical Markdown report, and publishing consistent results to Confluence and approved delivery channels.

The initial scope includes Jira projects `SAM1` and `KAN`, all issue types, configurable team filtering, weekly scheduled execution, manual execution, and traceable evidence for every finding.

## 2. Technology Baseline

- The frontend shall use React 18 with Vite.
- The backend shall use Node.js with Express.
- The persistence layer shall use PostgreSQL 15.
- PostgreSQL shall run locally and in development environments through Docker Compose.
- Frontend and backend code shall use TypeScript unless an exception is documented and approved.
- External integrations shall be isolated behind backend adapters and shall not be called directly from browser code.

Changing a baseline technology requires an architecture decision record and an update to this constitution before implementation begins.

## 3. Architecture and Boundaries

- The frontend shall present report summaries, findings, filters, run status, and links without owning business rules or credentials.
- The backend shall own configuration loading, authentication to external services, Jira retrieval, risk evaluation, report rendering, persistence, and delivery orchestration.
- Domain logic shall remain independent of Express request and response objects.
- Integration clients shall expose typed interfaces and normalize external API responses before they enter the domain layer.
- PostgreSQL shall be the source of truth for stored runs, normalized findings, report metadata, and audit events. Raw external payloads shall be retained only when justified and sanitized.
- Database schema changes shall be versioned and applied through repeatable migrations.

## 4. Risk and Report Integrity

- Risk thresholds shall be configuration values, not hard-coded business decisions.
- Initial signals shall cover overdue, blocked, stale, missed commitment, high priority, dependency risk, and story-point variance.
- Every finding shall include severity, triggering rule, Jira key, project, available sprint and owner information, evidence, and a source URL.
- Findings triggered by multiple rules shall be deduplicated without losing the underlying signals.
- Markdown shall remain the canonical report format; channel-specific formats may summarize it but must not contradict it.
- A failed source retrieval or validation step shall not produce a successful partial report.

## 5. Security and Privacy

- Secrets shall come from environment variables or deployment secret stores and shall never be committed, rendered in the frontend, or written to logs.
- Local `.env` files shall remain ignored by Git; `.env.example` may contain names and safe placeholders only.
- Logs, reports, and database records shall exclude tokens, passwords, full issue comments, and unnecessary personal data.
- Jira and Confluence permissions shall follow least privilege. Broad edit access shall not be enabled without explicit approval.
- All backend endpoints shall validate input, enforce authentication and authorization where required, and return safe error messages.
- Dependencies shall be reviewed for known vulnerabilities before release.

## 6. Testing and Quality Gates

- Every risk rule shall have unit tests covering normal cases and both sides of each configured threshold.
- API clients shall test pagination, retries, timeouts, empty responses, malformed responses, and upstream failures.
- Report rendering shall be tested for empty results, mixed severities, missing optional fields, multiple projects, and stable source links.
- HTTP routes shall have integration tests covering authorization, validation, success, and failure responses.
- Database behavior shall be tested against PostgreSQL 15, preferably using the Docker Compose service in CI or an equivalent disposable database.
- Pull requests shall pass formatting, linting, type checking, tests, migration checks, and Markdown validation before merge.
- Tests shall verify real behavior and shall not rely only on mock call assertions.

## 7. Operations and Reliability

- The application shall expose structured health checks for the backend and database.
- Scheduled and manual runs shall be idempotent for the same report scope and period.
- External calls shall use bounded timeouts, safe retries where appropriate, and sanitized diagnostics.
- Every run shall record start time, scope, outcome, and correlation information without secrets.
- GitHub Actions shall run the weekly schedule and support manual dispatch with optional project and sprint scope.
- The canonical report and sanitized failure diagnostics shall be retained according to the project retention policy.

## 8. Frontend Standards

- The UI shall be accessible, responsive, and usable with keyboard navigation.
- Loading, empty, success, partial failure, and retry states shall be explicit.
- The frontend shall use server-provided data and shall not duplicate risk calculations.
- User-visible timestamps shall include the relevant timezone, with Asia/Kolkata as the initial reporting timezone.
- Destructive or permission-sensitive actions shall require clear confirmation and appropriate authorization.

## 9. Change Control

Every feature or architectural change shall identify its affected constitution principles, update tests and documentation, and preserve backward compatibility unless a migration plan is approved. Exceptions must be documented with the reason, owner, scope, and expiry or review date.

## 10. Definition of Done

A change is complete only when:

- Its acceptance criteria and relevant constitution principles are satisfied.
- Type checking, linting, formatting, focused tests, and the full applicable test suite pass.
- Database migrations and configuration changes are documented and validated.
- Security, privacy, authorization, observability, and failure behavior are reviewed.
- User-facing behavior and operational instructions are documented.
- The change is reproducible from a clean checkout using the documented Node.js, Docker, and PostgreSQL setup.

## Governance

The constitution is the highest-level engineering policy for this project. When implementation details conflict with it, the conflict must be resolved by updating the implementation or recording an approved exception. Changes to this file require a version increment and a brief rationale in the change description.
