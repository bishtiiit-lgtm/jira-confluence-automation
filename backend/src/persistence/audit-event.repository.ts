import type { QueryResultRow } from 'pg';
import { rethrowPersistenceError, type DatabaseExecutor } from './database.js';
import type { AuditEventInput } from './types.js';

interface AuditEventIdRow extends QueryResultRow {
  id: string;
}

export class AuditEventRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async append(input: AuditEventInput): Promise<string> {
    try {
      const result = await this.database.query<AuditEventIdRow>(
        `INSERT INTO audit_events (
           report_run_id, actor_identifier, event_name, entity_type, entity_id,
           correlation_id, details, occurred_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          input.reportRunId ?? null,
          input.actorIdentifier ?? null,
          input.eventName,
          input.entityType,
          input.entityId ?? null,
          input.correlationId ?? null,
          input.details ?? {},
          input.occurredAt ?? new Date(),
        ],
      );
      return result.rows[0].id;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }
}
