# Jira/Confluence Delivery Risk Summary

This repository is the Node.js/TypeScript implementation for the Jira/Confluence Delivery Risk Summary application. It follows the ratified constitution and the approved specification and intentionally supersedes the earlier Python-based design notes.

## Architecture and package boundaries

The active implementation is organized as a small monorepo:

- `backend/` — Express API, adapters, persistence, risk orchestration, and report workflow logic.
- `frontend/` — React 18 + Vite client for reports, runs, and operational views.
- `packages/shared-types/` — shared API and domain types, enum values, and serialized contracts.
- `packages/report-model/` — report model objects used by rendering, persistence, and UI snapshots.
- `packages/validation/` — validation helpers and configuration guardrails.
- `spec/` — governing requirements, architecture decisions, and implementation planning.

The approved implementation decisions are recorded in [spec/architecture-decisions.md](spec/architecture-decisions.md). It distinguishes settled contracts from integration details that remain open and identifies application Authentication and Authorization as deferred. The relational schema design is in [spec/database.md](spec/database.md).

## Historical note

The older Python architecture in legacy documents such as `project_spec.md` and the historical backlog entries is preserved only for traceability. It is intentionally superseded by the current Node.js/Express/React/PostgreSQL baseline and must not be used as the active implementation guide.

## Local development

Copy `.env.example` to `.env` for local-only settings, then start PostgreSQL 15:

```bash
docker compose up -d --wait postgres
docker compose ps
```

Compose waits on PostgreSQL's health check before reporting the service healthy. The named `postgres_data` volume preserves database data across container restarts. Stop the service without deleting its data with `docker compose down`; `docker compose down -v` deletes the local database volume.

Use the workspace scripts from the repository root to run the backend and frontend:

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

The implementation remains aligned to the approved Node.js/Express/React/TypeScript baseline in the constitution and specification.

## Environment configuration

The backend loads `.env` for local development and validates values before use. `NODE_ENV`, `PORT`, `DATABASE_URL`, `REPORT_TIMEZONE`, and `PROJECT_KEYS` have safe development defaults; the example file lists each default explicitly. Production configuration requires Jira and Confluence URLs, identifiers, and credentials. SMTP and Teams settings are optional and become required when their destination is enabled. Retention and timeout values are positive bounded integers. Timezones use IANA names, URLs must use HTTP(S) (PostgreSQL URLs must use `postgres` or `postgresql`), and project keys are uppercase Jira-style keys.

Authentication and Authorization configuration is intentionally deferred. Jira and destination credentials are external-service secrets, not application user-authentication settings. Keep real secrets in deployment secret storage; validation errors report field names and safe reasons only, never submitted values.

| Variable | Classification | Default or requirement |
| --- | --- | --- |
| `NODE_ENV`, `PORT`, `DATABASE_URL`, `REPORT_TIMEZONE`, `PROJECT_KEYS` | Required runtime settings | Development defaults are supplied in `.env.example`. |
| `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`, `CONFLUENCE_BASE_URL`, `CONFLUENCE_SPACE_KEY`, `CONFLUENCE_PAGE_ID`, `CONFLUENCE_API_TOKEN` | Required in production | May be omitted for local development without integrations. Tokens belong in secret storage. |
| `JIRA_TEAM_IDENTIFIER` | Optional pending Jira team-filter decision | No default; leave unset until the team mapping is confirmed. |
| `JIRA_LOOKBACK_DAYS`, `UPSTREAM_TIMEOUT_MS`, `RETENTION_*_DAYS` | Optional runtime controls | Defaults: 90-day lookback, 10-second upstream timeout, 730-day report/audit retention, 90-day diagnostics retention. |
| `SMTP_*` | Optional destination | SMTP credentials and sender/recipient values are required when `SMTP_ENABLED=true`. |
| `TEAMS_WEBHOOK_URL` | Optional destination secret | Required when `TEAMS_ENABLED=true`; store the URL in secret storage. |
| `GITHUB_REPOSITORY`, `GITHUB_ENVIRONMENT` | Optional workflow metadata | GitHub Actions supplies its workflow token; do not add a personal access token here. |
| `POSTGRES_*` | Local Compose settings | Local-development values only; never reuse them as production credentials. |

## Quality checks

Run the complete local quality gate with:

```bash
npm run validate
```

The command checks formatting, lint, TypeScript, backend and frontend tests, and Markdown. Run `npm run test:coverage` to generate package-specific coverage reports. GitHub Actions runs both commands for pushes and pull requests.
