import type { QueryResultRow } from 'pg';
import { rethrowPersistenceError, type DatabaseExecutor } from './database.js';
import type {
  DeliveryAttemptStatus,
  PublicationAttemptInput,
  PublicationDestination,
  WorkflowArtifactAttemptInput,
} from './types.js';

interface PublicationRow extends QueryResultRow {
  id: string;
  report_run_id: string;
  destination: PublicationDestination;
  attempt_number: number;
  idempotency_key: string;
  status: DeliveryAttemptStatus;
  external_reference: string | null;
  attempted_at: Date;
  completed_at: Date | null;
  sanitized_error: string | null;
}

interface ArtifactRow extends QueryResultRow {
  id: string;
  report_run_id: string;
  attempt_number: number;
  artifact_name: string;
  workflow_run_id: string | null;
  artifact_url: string | null;
  status: DeliveryAttemptStatus;
  attempted_at: Date;
  completed_at: Date | null;
  expires_at: Date | null;
  sanitized_error: string | null;
}

export interface PublicationAttemptRecord {
  id: string;
  reportRunId: string;
  destination: PublicationDestination;
  attemptNumber: number;
  idempotencyKey: string;
  status: DeliveryAttemptStatus;
  externalReference: string | null;
  attemptedAt: Date;
  completedAt: Date | null;
  sanitizedError: string | null;
}

export interface WorkflowArtifactAttemptRecord {
  id: string;
  reportRunId: string;
  attemptNumber: number;
  artifactName: string;
  workflowRunId: string | null;
  artifactUrl: string | null;
  status: DeliveryAttemptStatus;
  attemptedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  sanitizedError: string | null;
}

function mapPublication(row: PublicationRow): PublicationAttemptRecord {
  return {
    id: row.id,
    reportRunId: row.report_run_id,
    destination: row.destination,
    attemptNumber: row.attempt_number,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    externalReference: row.external_reference,
    attemptedAt: row.attempted_at,
    completedAt: row.completed_at,
    sanitizedError: row.sanitized_error,
  };
}

function mapArtifact(row: ArtifactRow): WorkflowArtifactAttemptRecord {
  return {
    id: row.id,
    reportRunId: row.report_run_id,
    attemptNumber: row.attempt_number,
    artifactName: row.artifact_name,
    workflowRunId: row.workflow_run_id,
    artifactUrl: row.artifact_url,
    status: row.status,
    attemptedAt: row.attempted_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    sanitizedError: row.sanitized_error,
  };
}

export class PublicationRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async createOrGetPublicationAttempt(
    input: PublicationAttemptInput,
  ): Promise<{ attempt: PublicationAttemptRecord; created: boolean }> {
    try {
      const inserted = await this.database.query<PublicationRow>(
        `INSERT INTO publication_attempts (
           report_run_id, destination, attempt_number, idempotency_key,
           status, external_reference, attempted_at, completed_at, sanitized_error
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, report_run_id, destination, attempt_number, idempotency_key,
                   status, external_reference, attempted_at, completed_at, sanitized_error`,
        [
          input.reportRunId,
          input.destination,
          input.attemptNumber,
          input.idempotencyKey,
          input.status,
          input.externalReference ?? null,
          input.attemptedAt,
          input.completedAt ?? null,
          input.sanitizedError ?? null,
        ],
      );
      if (inserted.rows[0]) {
        return { attempt: mapPublication(inserted.rows[0]), created: true };
      }

      const existing = await this.database.query<PublicationRow>(
        `SELECT id, report_run_id, destination, attempt_number, idempotency_key,
                status, external_reference, attempted_at, completed_at, sanitized_error
         FROM publication_attempts WHERE idempotency_key = $1`,
        [input.idempotencyKey],
      );
      const row = existing.rows[0];
      if (
        !row ||
        row.report_run_id !== input.reportRunId ||
        row.destination !== input.destination ||
        row.attempt_number !== input.attemptNumber
      ) {
        throw new Error(
          'Publication idempotency key was reused for a different attempt.',
        );
      }
      return { attempt: mapPublication(row), created: false };
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async updatePublicationStatus(input: {
    id: string;
    status: DeliveryAttemptStatus;
    externalReference?: string | null;
    completedAt?: Date | null;
    sanitizedError?: string | null;
  }): Promise<PublicationAttemptRecord | null> {
    try {
      const result = await this.database.query<PublicationRow>(
        `UPDATE publication_attempts
         SET status = $2,
             external_reference = $3,
             completed_at = $4,
             sanitized_error = $5
         WHERE id = $1
         RETURNING id, report_run_id, destination, attempt_number, idempotency_key,
                   status, external_reference, attempted_at, completed_at, sanitized_error`,
        [
          input.id,
          input.status,
          input.externalReference ?? null,
          input.completedAt ?? null,
          input.sanitizedError ?? null,
        ],
      );
      return result.rows[0] ? mapPublication(result.rows[0]) : null;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async createOrGetArtifactAttempt(
    input: WorkflowArtifactAttemptInput,
  ): Promise<{ attempt: WorkflowArtifactAttemptRecord; created: boolean }> {
    try {
      const inserted = await this.database.query<ArtifactRow>(
        `INSERT INTO workflow_artifact_attempts (
           report_run_id, attempt_number, artifact_name, workflow_run_id,
           artifact_url, status, attempted_at, completed_at, expires_at, sanitized_error
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (report_run_id, attempt_number) DO NOTHING
         RETURNING id, report_run_id, attempt_number, artifact_name, workflow_run_id,
                   artifact_url, status, attempted_at, completed_at, expires_at, sanitized_error`,
        [
          input.reportRunId,
          input.attemptNumber,
          input.artifactName,
          input.workflowRunId ?? null,
          input.artifactUrl ?? null,
          input.status,
          input.attemptedAt,
          input.completedAt ?? null,
          input.expiresAt ?? null,
          input.sanitizedError ?? null,
        ],
      );
      if (inserted.rows[0]) {
        return { attempt: mapArtifact(inserted.rows[0]), created: true };
      }

      const existing = await this.database.query<ArtifactRow>(
        `SELECT id, report_run_id, attempt_number, artifact_name, workflow_run_id,
                artifact_url, status, attempted_at, completed_at, expires_at, sanitized_error
         FROM workflow_artifact_attempts
         WHERE report_run_id = $1 AND attempt_number = $2`,
        [input.reportRunId, input.attemptNumber],
      );
      const row = existing.rows[0];
      if (!row || row.artifact_name !== input.artifactName) {
        throw new Error(
          'Artifact attempt identity was reused for a different artifact.',
        );
      }
      return { attempt: mapArtifact(row), created: false };
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }

  async updateArtifactStatus(input: {
    id: string;
    status: DeliveryAttemptStatus;
    artifactUrl?: string | null;
    completedAt?: Date | null;
    expiresAt?: Date | null;
    sanitizedError?: string | null;
  }): Promise<WorkflowArtifactAttemptRecord | null> {
    try {
      const result = await this.database.query<ArtifactRow>(
        `UPDATE workflow_artifact_attempts
         SET status = $2,
             artifact_url = $3,
             completed_at = $4,
             expires_at = $5,
             sanitized_error = $6
         WHERE id = $1
         RETURNING id, report_run_id, attempt_number, artifact_name, workflow_run_id,
                   artifact_url, status, attempted_at, completed_at, expires_at, sanitized_error`,
        [
          input.id,
          input.status,
          input.artifactUrl ?? null,
          input.completedAt ?? null,
          input.expiresAt ?? null,
          input.sanitizedError ?? null,
        ],
      );
      return result.rows[0] ? mapArtifact(result.rows[0]) : null;
    } catch (error) {
      rethrowPersistenceError(error);
    }
  }
}
