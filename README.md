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

## Historical note

The older Python architecture in legacy documents such as `project_spec.md` and the historical backlog entries is preserved only for traceability. It is intentionally superseded by the current Node.js/Express/React/PostgreSQL baseline and must not be used as the active implementation guide.

## Local development

Use the workspace scripts from the repository root to run the backend and frontend together:

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

The implementation remains aligned to the approved Node.js/Express/React/TypeScript baseline in the constitution and specification.
