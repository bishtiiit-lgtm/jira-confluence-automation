import { z } from 'zod';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/delivery_risk_dev';

const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const optionalHttpUrl = optionalText.pipe(
  z
    .string()
    .url()
    .refine(isHttpUrl, {
      message: 'must use HTTP or HTTPS',
    })
    .optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .default(DEFAULT_DATABASE_URL)
      .superRefine((value, context) => {
        try {
          if (!['postgres:', 'postgresql:'].includes(new URL(value).protocol)) {
            context.addIssue({
              code: 'custom',
              message: 'must use the PostgreSQL protocol',
            });
          }
        } catch {
          context.addIssue({
            code: 'custom',
            message: 'must be a valid PostgreSQL URL',
          });
        }
      }),
    REPORT_TIMEZONE: z
      .string()
      .default('Asia/Kolkata')
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'must be a valid IANA timezone'),
    PROJECT_KEYS: z
      .string()
      .default('SAM1,KAN')
      .transform((value) =>
        value
          .split(',')
          .map((key) => key.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,9}$/)).min(1)),
    JIRA_TEAM_IDENTIFIER: optionalText,
    JIRA_BASE_URL: optionalHttpUrl,
    JIRA_USER_EMAIL: optionalText.pipe(z.email().optional()),
    JIRA_API_TOKEN: optionalText,
    JIRA_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(365).default(90),
    CONFLUENCE_BASE_URL: optionalHttpUrl,
    CONFLUENCE_SPACE_KEY: optionalText,
    CONFLUENCE_PAGE_ID: optionalText,
    CONFLUENCE_API_TOKEN: optionalText,
    SMTP_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_HOST: optionalText,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USERNAME: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_FROM: optionalText.pipe(z.email().optional()),
    SMTP_RECIPIENTS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((email) => email.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.email())),
    TEAMS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    TEAMS_WEBHOOK_URL: optionalHttpUrl,
    GITHUB_REPOSITORY: optionalText.pipe(
      z
        .string()
        .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
        .optional(),
    ),
    GITHUB_ENVIRONMENT: optionalText,
    RETENTION_REPORT_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(3650)
      .default(730),
    RETENTION_AUDIT_DAYS: z.coerce.number().int().min(1).max(3650).default(730),
    RETENTION_DIAGNOSTICS_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(3650)
      .default(90),
    UPSTREAM_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(120000)
      .default(10000),
  })
  .superRefine((config, context) => {
    if (new Set(config.PROJECT_KEYS).size !== config.PROJECT_KEYS.length) {
      context.addIssue({
        code: 'custom',
        path: ['PROJECT_KEYS'],
        message: 'must not contain duplicates',
      });
    }

    if (config.NODE_ENV === 'production') {
      const requiredProductionValues = [
        'JIRA_BASE_URL',
        'JIRA_USER_EMAIL',
        'JIRA_API_TOKEN',
        'CONFLUENCE_BASE_URL',
        'CONFLUENCE_SPACE_KEY',
        'CONFLUENCE_PAGE_ID',
        'CONFLUENCE_API_TOKEN',
      ] as const;

      for (const key of requiredProductionValues) {
        if (!config[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required in production',
          });
        }
      }
    }

    if (config.SMTP_ENABLED) {
      const requiredSmtpValues = [
        'SMTP_HOST',
        'SMTP_USERNAME',
        'SMTP_PASSWORD',
        'SMTP_FROM',
      ] as const;

      for (const key of requiredSmtpValues) {
        if (!config[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required when SMTP_ENABLED is true',
          });
        }
      }
      if (config.SMTP_RECIPIENTS.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['SMTP_RECIPIENTS'],
          message: 'requires at least one recipient when SMTP_ENABLED is true',
        });
      }
    }

    if (config.TEAMS_ENABLED && !config.TEAMS_WEBHOOK_URL) {
      context.addIssue({
        code: 'custom',
        path: ['TEAMS_WEBHOOK_URL'],
        message: 'is required when TEAMS_ENABLED is true',
      });
    }
  });

export type RuntimeEnvironment = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  reportTimezone: string;
  projectKeys: string[];
  jiraTeamIdentifier?: string;
  jiraBaseUrl?: string;
  jiraUserEmail?: string;
  jiraApiToken?: string;
  jiraLookbackDays: number;
  confluenceBaseUrl?: string;
  confluenceSpaceKey?: string;
  confluencePageId?: string;
  confluenceApiToken?: string;
  smtpEnabled: boolean;
  smtpHost?: string;
  smtpPort: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  smtpRecipients: string[];
  teamsEnabled: boolean;
  teamsWebhookUrl?: string;
  githubRepository?: string;
  githubEnvironment?: string;
  reportRetentionDays: number;
  auditRetentionDays: number;
  diagnosticsRetentionDays: number;
  upstreamTimeoutMs: number;
};

const SAFE_ISSUE_MESSAGES: Record<string, string> = {
  invalid_type: 'has an invalid type or is missing',
  invalid_format: 'has an invalid format',
  invalid_value: 'has an unsupported value',
  too_small: 'is below the allowed minimum',
  too_big: 'exceeds the allowed maximum',
  custom: 'is invalid',
};

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): RuntimeEnvironment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const field = issue.path.map(String).join('.') || 'environment';
        return `${field} ${SAFE_ISSUE_MESSAGES[issue.code] ?? 'is invalid'}`;
      })
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const config = result.data;
  return {
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    databaseUrl: config.DATABASE_URL,
    reportTimezone: config.REPORT_TIMEZONE,
    projectKeys: config.PROJECT_KEYS,
    jiraTeamIdentifier: config.JIRA_TEAM_IDENTIFIER,
    jiraBaseUrl: config.JIRA_BASE_URL,
    jiraUserEmail: config.JIRA_USER_EMAIL,
    jiraApiToken: config.JIRA_API_TOKEN,
    jiraLookbackDays: config.JIRA_LOOKBACK_DAYS,
    confluenceBaseUrl: config.CONFLUENCE_BASE_URL,
    confluenceSpaceKey: config.CONFLUENCE_SPACE_KEY,
    confluencePageId: config.CONFLUENCE_PAGE_ID,
    confluenceApiToken: config.CONFLUENCE_API_TOKEN,
    smtpEnabled: config.SMTP_ENABLED,
    smtpHost: config.SMTP_HOST,
    smtpPort: config.SMTP_PORT,
    smtpUsername: config.SMTP_USERNAME,
    smtpPassword: config.SMTP_PASSWORD,
    smtpFrom: config.SMTP_FROM,
    smtpRecipients: config.SMTP_RECIPIENTS,
    teamsEnabled: config.TEAMS_ENABLED,
    teamsWebhookUrl: config.TEAMS_WEBHOOK_URL,
    githubRepository: config.GITHUB_REPOSITORY,
    githubEnvironment: config.GITHUB_ENVIRONMENT,
    reportRetentionDays: config.RETENTION_REPORT_DAYS,
    auditRetentionDays: config.RETENTION_AUDIT_DAYS,
    diagnosticsRetentionDays: config.RETENTION_DIAGNOSTICS_DAYS,
    upstreamTimeoutMs: config.UPSTREAM_TIMEOUT_MS,
  };
}
