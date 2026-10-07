import type { DatabaseExecutor } from './database.js';
import { AuditEventRepository } from './audit-event.repository.js';
import { FindingRepository } from './finding.repository.js';
import { PublicationRepository } from './publication.repository.js';
import { ReportRunRepository } from './report-run.repository.js';
import { SnapshotRepository } from './snapshot.repository.js';
import { RiskSummaryRepository } from './summary.repository.js';

export function createRepositories(database: DatabaseExecutor) {
  return {
    auditEvents: new AuditEventRepository(database),
    findings: new FindingRepository(database),
    publications: new PublicationRepository(database),
    reportRuns: new ReportRunRepository(database),
    snapshots: new SnapshotRepository(database),
    summaries: new RiskSummaryRepository(database),
  };
}

export { createDatabasePool, withTransaction } from './database.js';
export { PersistenceConstraintError } from './database.js';
export type * from './types.js';
