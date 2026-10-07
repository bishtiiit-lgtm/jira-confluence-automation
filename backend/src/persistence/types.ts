export const REPORT_RUN_STATUSES = [
  'Queued',
  'Running',
  'Completed',
  'Completed with delivery warnings',
  'Failed',
] as const;

export type ReportRunStatus = (typeof REPORT_RUN_STATUSES)[number];
export type RunTriggerType = 'Scheduled' | 'Manual';
export type Severity = 'High' | 'Medium' | 'Low';
export type SummarySeverity = Severity | 'No findings';
export type SnapshotSprintState = 'future' | 'active' | 'closed';
export type PublicationDestination = 'confluence' | 'email' | 'teams';
export type DeliveryAttemptStatus =
  'Pending' | 'Succeeded' | 'Failed' | 'Skipped';

export interface ReportRun {
  id: string;
  idempotencyKey: string;
  scopeKey: string;
  requestedScope: Record<string, unknown>;
  triggerType: RunTriggerType;
  createdBy: string | null;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  reportTimezone: string;
  status: ReportRunStatus;
  currentStage: string | null;
  correlationId: string;
  errorCode: string | null;
  createdAt: string;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface CreateReportRunInput {
  idempotencyKey: string;
  scopeKey: string;
  requestedScope: Record<string, unknown>;
  triggerType: RunTriggerType;
  createdBy?: string | null;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  reportTimezone: string;
  correlationId: string;
}

export interface CreateReportRunResult {
  run: ReportRun;
  created: boolean;
}

export interface ReportRunCursor {
  createdAt: string;
  id: string;
}

export interface ReportRunPage {
  items: ReportRun[];
  nextCursor: ReportRunCursor | null;
}

export interface ProjectSnapshotInput {
  reportRunId: string;
  projectKey: string;
  name?: string | null;
  sourceUrl?: string | null;
  capturedAt: Date;
}

export interface SprintSnapshotInput {
  reportRunId: string;
  projectKey: string;
  jiraSprintId: string;
  name: string;
  state: SnapshotSprintState;
  startAt?: Date | null;
  endAt?: Date | null;
  completedAt?: Date | null;
}

export interface IssueSnapshotInput {
  reportRunId: string;
  projectKey: string;
  jiraIssueKey: string;
  summary: string;
  issueType?: string | null;
  statusName?: string | null;
  statusCategory?: string | null;
  priorityName?: string | null;
  assigneeAccountId?: string | null;
  assigneeDisplayName?: string | null;
  reporterAccountId?: string | null;
  reporterDisplayName?: string | null;
  dueDate?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  resolvedAt?: Date | null;
  originalEstimateSeconds?: number | null;
  remainingEstimateSeconds?: number | null;
  storyPoints?: string | number | null;
  labels?: string[];
  sourceUrl: string;
}

export interface IssueLinkInput {
  reportRunId: string;
  jiraLinkId: string;
  sourceIssueId: string;
  targetIssueId?: string | null;
  targetIssueKey: string;
  linkTypeName: string;
  direction: 'inward' | 'outward';
}

export interface FindingInput {
  reportRunId: string;
  sprintSnapshotId?: string | null;
  jiraIssueKey: string;
  severity: Severity;
  evidence: Record<string, unknown>;
  recommendation: string;
  suggestedOwner?: string | null;
  targetDate?: string | null;
  sourceUrl: string;
  detectedAt: Date;
}

export interface FindingSignalInput {
  findingId: string;
  signalType:
    | 'overdue'
    | 'blocked'
    | 'stale'
    | 'missed_commitment'
    | 'high_priority'
    | 'dependency_risk'
    | 'story_point_variance';
  severity: Severity;
  thresholdSnapshot: Record<string, unknown>;
  evidence: Record<string, unknown>;
}

export interface RiskSummaryInput {
  reportRunId: string;
  scopeType: 'overall' | 'project' | 'sprint';
  projectKey?: string | null;
  sprintSnapshotId?: string | null;
  overallSeverity: SummarySeverity;
  findingCount: number;
  generatedAt: Date;
}

export interface RiskSummaryCountInput {
  riskSummaryId: string;
  dimension: 'severity' | 'signal';
  value: string;
  count: number;
}

export interface PublicationAttemptInput {
  reportRunId: string;
  destination: PublicationDestination;
  attemptNumber: number;
  idempotencyKey: string;
  status: DeliveryAttemptStatus;
  externalReference?: string | null;
  attemptedAt: Date;
  completedAt?: Date | null;
  sanitizedError?: string | null;
}

export interface WorkflowArtifactAttemptInput {
  reportRunId: string;
  attemptNumber: number;
  artifactName: string;
  workflowRunId?: string | null;
  artifactUrl?: string | null;
  status: DeliveryAttemptStatus;
  attemptedAt: Date;
  completedAt?: Date | null;
  expiresAt?: Date | null;
  sanitizedError?: string | null;
}

export interface AuditEventInput {
  reportRunId?: string | null;
  actorIdentifier?: string | null;
  eventName: string;
  entityType: string;
  entityId?: string | null;
  correlationId?: string | null;
  details?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface RunConfigurationSnapshotInput {
  reportRunId: string;
  configurationVersion?: number | null;
  effectiveSettings: Record<string, unknown>;
  settingsHash: string;
}
