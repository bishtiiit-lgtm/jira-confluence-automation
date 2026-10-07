import { describe, expect, it } from 'vitest';
import { loadEnvironment } from './environment.js';

describe('loadEnvironment', () => {
  it('loads safe defaults for local development', () => {
    const env = loadEnvironment({});

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3000);
    expect(env.reportTimezone).toBe('Asia/Kolkata');
    expect(env.databaseUrl).toBe(
      'postgresql://postgres:postgres@localhost:5432/delivery_risk_dev',
    );
    expect(env.projectKeys).toEqual(['SAM1', 'KAN']);
    expect(env.jiraLookbackDays).toBe(90);
    expect(env.reportRetentionDays).toBe(730);
    expect(env.auditRetentionDays).toBe(730);
    expect(env.diagnosticsRetentionDays).toBe(90);
    expect(env.smtpEnabled).toBe(false);
    expect(env.teamsEnabled).toBe(false);
  });

  it('parses configured URLs, project keys, recipients, and numeric settings', () => {
    const env = loadEnvironment({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/delivery_risk',
      REPORT_TIMEZONE: 'UTC',
      PROJECT_KEYS: 'KAN,SAM1',
      JIRA_BASE_URL: 'https://jira.example.test',
      JIRA_USER_EMAIL: 'reports@example.test',
      SMTP_ENABLED: 'true',
      SMTP_HOST: 'smtp.example.test',
      SMTP_USERNAME: 'sender@example.test',
      SMTP_PASSWORD: 'smtp-secret',
      SMTP_FROM: 'sender@example.test',
      SMTP_RECIPIENTS: 'one@example.test, two@example.test',
      SMTP_PORT: '465',
      TEAMS_ENABLED: 'true',
      TEAMS_WEBHOOK_URL: 'https://teams.example.test/webhook',
      JIRA_LOOKBACK_DAYS: '45',
      RETENTION_REPORT_DAYS: '365',
      UPSTREAM_TIMEOUT_MS: '5000',
    });

    expect(env.databaseUrl).toContain('delivery_risk');
    expect(env.projectKeys).toEqual(['KAN', 'SAM1']);
    expect(env.jiraBaseUrl).toBe('https://jira.example.test');
    expect(env.jiraLookbackDays).toBe(45);
    expect(env.smtpEnabled).toBe(true);
    expect(env.smtpPort).toBe(465);
    expect(env.smtpRecipients).toEqual([
      'one@example.test',
      'two@example.test',
    ]);
    expect(env.teamsEnabled).toBe(true);
    expect(env.reportRetentionDays).toBe(365);
    expect(env.upstreamTimeoutMs).toBe(5000);
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '65536'],
    ['DATABASE_URL', 'https://db.example.test'],
    ['REPORT_TIMEZONE', 'Not/A_Timezone'],
    ['PROJECT_KEYS', 'KAN,invalid key'],
    ['PROJECT_KEYS', 'KAN,KAN'],
    ['JIRA_BASE_URL', 'not-a-url'],
    ['JIRA_LOOKBACK_DAYS', '0'],
    ['NODE_ENV', 'staging'],
  ])('rejects invalid %s without echoing the supplied value', (key, value) => {
    expect(() => loadEnvironment({ [key]: value })).toThrow(
      `Invalid environment configuration: ${key}`,
    );
  });

  it('requires Jira and Confluence settings in production', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'production' })).toThrow(
      /JIRA_BASE_URL.*JIRA_USER_EMAIL.*JIRA_API_TOKEN.*CONFLUENCE_BASE_URL/,
    );
  });

  it('requires credentials for enabled delivery integrations', () => {
    expect(() => loadEnvironment({ SMTP_ENABLED: 'true' })).toThrow(
      /SMTP_HOST.*SMTP_USERNAME.*SMTP_PASSWORD.*SMTP_FROM.*SMTP_RECIPIENTS/,
    );
    expect(() => loadEnvironment({ TEAMS_ENABLED: 'true' })).toThrow(
      /TEAMS_WEBHOOK_URL/,
    );
  });

  it('never includes secret values in validation errors', () => {
    const secret = 'do-not-print-this-secret';

    let thrownError: unknown;
    try {
      loadEnvironment({
        NODE_ENV: 'production',
        JIRA_API_TOKEN: secret,
        CONFLUENCE_API_TOKEN: secret,
        DATABASE_URL: 'invalid-database-url',
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    const message = (thrownError as Error).message;
    expect(message).not.toContain(secret);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('CONFLUENCE_BASE_URL');
  });
});
