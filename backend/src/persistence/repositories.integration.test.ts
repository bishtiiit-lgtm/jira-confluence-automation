import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import dotenv from 'dotenv';
import pg from 'pg';
import {
  createRepositories,
  createDatabasePool,
  withTransaction,
} from './index.js';
import { PersistenceConstraintError } from './database.js';
import type { CreateReportRunInput } from './types.js';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

const { Client } = pg;
const rootDatabaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/delivery_risk_dev';
const backendDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const migrationRunner = resolve(backendDirectory, 'scripts/migrate.mjs');
const isolatedDatabaseName = `delivery_risk_repo_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const isolatedDatabaseUrl = new URL(rootDatabaseUrl);
isolatedDatabaseUrl.pathname = `/${isolatedDatabaseName}`;

let adminClient: InstanceType<typeof Client> | undefined;
let pool: ReturnType<typeof createDatabasePool> | undefined;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function createRunInput(
  overrides: Partial<CreateReportRunInput> = {},
): CreateReportRunInput {
  const suffix = randomUUID();
  return {
    idempotencyKey: `test-${suffix}`,
    scopeKey: `KAN:${suffix}`,
    requestedScope: { projects: ['KAN'] },
    triggerType: 'Manual',
    createdBy: null,
    reportPeriodStart: '2026-10-05',
    reportPeriodEnd: '2026-10-11',
    reportTimezone: 'Asia/Kolkata',
    correlationId: `correlation-${suffix}`,
    ...overrides,
  };
}

beforeAll(async () => {
  const adminUrl = new URL(rootDatabaseUrl);
  adminUrl.pathname = '/postgres';
  adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  await adminClient.query(
    `CREATE DATABASE ${quoteIdentifier(isolatedDatabaseName)}`,
  );

  execFileSync(process.execPath, [migrationRunner, 'up'], {
    cwd: backendDirectory,
    env: { ...process.env, DATABASE_URL: isolatedDatabaseUrl.toString() },
    stdio: 'pipe',
  });

  pool = createDatabasePool(isolatedDatabaseUrl.toString());
}, 120_000);

afterAll(async () => {
  await pool?.end();
  if (adminClient) {
    await adminClient.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(isolatedDatabaseName)}`,
    );
    await adminClient.end();
  }
}, 120_000);

describe('PostgreSQL persistence repositories', () => {
  it('creates or replays idempotent runs and paginates with stable typed cursors', async () => {
    const repositories = createRepositories(pool!);
    const firstInput = createRunInput();
    const first = await repositories.reportRuns.createOrGet(firstInput);
    const replay = await repositories.reportRuns.createOrGet(firstInput);
    const second = await repositories.reportRuns.createOrGet(createRunInput());

    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.run.id).toBe(first.run.id);
    expect(first.run.status).toBe('Queued');
    expect(first.run.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/,
    );
    expect(first.run.requestedScope).toEqual({ projects: ['KAN'] });

    const paginationIndex = await pool!.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'report_runs_created_status_idx'`,
    );
    expect(paginationIndex.rows).toHaveLength(1);

    const firstPage = await repositories.reportRuns.list({
      limit: 1,
      status: 'Queued',
    });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(firstPage.nextCursor?.createdAt).toBe(firstPage.items[0].createdAt);
    const secondPage = await repositories.reportRuns.list({
      limit: 1,
      cursor: firstPage.nextCursor,
      status: 'Queued',
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
    expect(secondPage.nextCursor).toBeNull();
    expect(second.run.id).not.toBe(first.run.id);

    const running = await repositories.reportRuns.updateStatus(
      first.run.id,
      'Running',
      'jira',
    );
    expect(running?.startedAt).toBeInstanceOf(Date);
    const completed = await repositories.reportRuns.updateStatus(
      first.run.id,
      'Completed',
    );
    expect(completed?.completedAt).toBeInstanceOf(Date);
  });

  it('persists snapshots, findings, signals, summaries, publications, artifacts, and audit events', async () => {
    const repositories = createRepositories(pool!);
    const { run } = await repositories.reportRuns.createOrGet(createRunInput());
    const capturedAt = new Date('2026-10-07T09:30:00.000Z');

    await repositories.snapshots.createRunConfigurationSnapshot({
      reportRunId: run.id,
      effectiveSettings: { lookbackDays: 90, projectKeys: ['KAN'] },
      settingsHash: 'a'.repeat(64),
    });
    await repositories.snapshots.createRunConfigurationSnapshot({
      reportRunId: run.id,
      effectiveSettings: { projectKeys: ['KAN'], lookbackDays: 90 },
      settingsHash: 'a'.repeat(64),
    });

    const projectId = await repositories.snapshots.upsertProject({
      reportRunId: run.id,
      projectKey: 'KAN',
      name: 'Kanban',
      sourceUrl: 'https://jira.example.test/projects/KAN',
      capturedAt,
    });
    const sprintId = await repositories.snapshots.upsertSprint({
      reportRunId: run.id,
      projectKey: 'KAN',
      jiraSprintId: 'sprint-42',
      name: 'Sprint 42',
      state: 'active',
      startAt: capturedAt,
      endAt: new Date('2026-10-14T09:30:00.000Z'),
    });
    const issueId = await repositories.snapshots.upsertIssue({
      reportRunId: run.id,
      projectKey: 'KAN',
      jiraIssueKey: 'KAN-42',
      summary: 'Investigate delivery risk',
      issueType: 'Task',
      statusName: 'In Progress',
      statusCategory: 'indeterminate',
      priorityName: 'High',
      assigneeAccountId: 'account-42',
      assigneeDisplayName: 'Test User',
      dueDate: '2026-10-08',
      createdAt: capturedAt,
      updatedAt: capturedAt,
      originalEstimateSeconds: 7200,
      storyPoints: 3,
      labels: ['delivery'],
      sourceUrl: 'https://jira.example.test/browse/KAN-42',
    });
    await repositories.snapshots.addIssueSprintMembership(
      run.id,
      issueId,
      sprintId,
    );
    const linkId = await repositories.snapshots.upsertIssueLink({
      reportRunId: run.id,
      jiraLinkId: 'link-42',
      sourceIssueId: issueId,
      targetIssueKey: 'KAN-43',
      linkTypeName: 'blocks',
      direction: 'outward',
    });

    const findingInput = {
      reportRunId: run.id,
      sprintSnapshotId: null,
      jiraIssueKey: 'KAN-42',
      severity: 'High' as const,
      evidence: { dueDate: '2026-10-08' },
      recommendation: 'Confirm the delivery owner and target date.',
      suggestedOwner: 'Test User',
      targetDate: '2026-10-08',
      sourceUrl: 'https://jira.example.test/browse/KAN-42',
      detectedAt: capturedAt,
    };
    const findingId = await repositories.findings.upsert(findingInput);
    expect(await repositories.findings.upsert(findingInput)).toBe(findingId);
    await repositories.findings.upsertSignal({
      findingId,
      signalType: 'overdue',
      severity: 'High',
      thresholdSnapshot: { overdueDays: 1 },
      evidence: { dueDate: '2026-10-08' },
    });
    await repositories.findings.upsertSignal({
      findingId,
      signalType: 'blocked',
      severity: 'High',
      thresholdSnapshot: { linkType: 'blocks' },
      evidence: { blockingIssue: 'KAN-43' },
    });

    const summaryId = await repositories.summaries.upsert({
      reportRunId: run.id,
      scopeType: 'overall',
      overallSeverity: 'High',
      findingCount: 1,
      generatedAt: capturedAt,
    });
    await repositories.summaries.upsertCount({
      riskSummaryId: summaryId,
      dimension: 'severity',
      value: 'High',
      count: 1,
    });
    expect(
      await repositories.summaries.upsertCount({
        riskSummaryId: summaryId,
        dimension: 'severity',
        value: 'High',
        count: 1,
      }),
    ).toBeUndefined();

    const publicationInput = {
      reportRunId: run.id,
      destination: 'confluence' as const,
      attemptNumber: 1,
      idempotencyKey: `publication-${run.id}`,
      status: 'Pending' as const,
      attemptedAt: capturedAt,
    };
    expect(
      (
        await repositories.publications.createOrGetPublicationAttempt(
          publicationInput,
        )
      ).created,
    ).toBe(true);
    expect(
      (
        await repositories.publications.createOrGetPublicationAttempt(
          publicationInput,
        )
      ).created,
    ).toBe(false);
    const artifact = await repositories.publications.createOrGetArtifactAttempt(
      {
        reportRunId: run.id,
        attemptNumber: 1,
        artifactName: 'delivery-risk-summary.md',
        workflowRunId: 'workflow-42',
        status: 'Pending',
        attemptedAt: capturedAt,
      },
    );
    expect(artifact.created).toBe(true);
    expect(
      (
        await repositories.publications.updateArtifactStatus({
          id: artifact.attempt.id,
          status: 'Failed',
          sanitizedError: 'Artifact upload failed.',
          completedAt: capturedAt,
        })
      )?.status,
    ).toBe('Failed');

    const auditId = await repositories.auditEvents.append({
      reportRunId: run.id,
      eventName: 'report.persisted',
      entityType: 'report_run',
      entityId: run.id,
      details: { projectKey: 'KAN' },
      occurredAt: capturedAt,
    });

    expect(projectId).toEqual(expect.any(String));
    expect(linkId).toEqual(expect.any(String));
    expect(auditId).toEqual(expect.any(String));
    expect(await repositories.findings.getById(findingId)).toMatchObject({
      reportRunId: run.id,
      jiraIssueKey: 'KAN-42',
      severity: 'High',
    });
    expect(
      await repositories.findings.listByRun({ reportRunId: run.id, limit: 10 }),
    ).toHaveLength(1);
    expect(await repositories.summaries.listByRun(run.id)).toHaveLength(1);
  });

  it('rejects active duplicate scope and rolls back all writes after a constraint failure', async () => {
    const repositories = createRepositories(pool!);
    const runInput = createRunInput({ scopeKey: 'KAN:atomic-scope' });
    const first = await repositories.reportRuns.createOrGet(runInput);

    await expect(
      repositories.reportRuns.createOrGet(
        createRunInput({
          scopeKey: runInput.scopeKey,
          reportPeriodStart: runInput.reportPeriodStart,
          reportPeriodEnd: runInput.reportPeriodEnd,
        }),
      ),
    ).rejects.toBeInstanceOf(PersistenceConstraintError);

    const failedInput = createRunInput({ scopeKey: 'KAN:rollback-scope' });
    await expect(
      withTransaction(pool!, async (transaction) => {
        const transactionRepositories = createRepositories(transaction);
        const created =
          await transactionRepositories.reportRuns.createOrGet(failedInput);
        await transactionRepositories.snapshots.upsertIssue({
          reportRunId: created.run.id,
          projectKey: 'MISSING',
          jiraIssueKey: 'KAN-99',
          summary: 'Must roll back',
          sourceUrl: 'https://jira.example.test/browse/KAN-99',
        });
      }),
    ).rejects.toBeInstanceOf(PersistenceConstraintError);

    expect(
      await repositories.reportRuns.getByIdempotencyKey(
        failedInput.idempotencyKey,
      ),
    ).toBeNull();
    expect(await repositories.reportRuns.getById(first.run.id)).not.toBeNull();
  });
});
