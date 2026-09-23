import { describe, expect, it } from 'vitest';
import { loadEnvironment } from './environment.js';

describe('loadEnvironment', () => {
  it('loads the default runtime configuration', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.REPORT_TIMEZONE = 'Asia/Kolkata';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/delivery_risk_dev';

    const env = loadEnvironment();

    expect(env.nodeEnv).toBe('development');
    expect(env.port).toBe(3000);
    expect(env.reportTimezone).toBe('Asia/Kolkata');
    expect(env.databaseUrl).toContain('delivery_risk_dev');
  });

  it('rejects invalid port values', () => {
    process.env.PORT = 'abc';
    expect(() => loadEnvironment()).toThrow('PORT must be a positive integer.');
  });
});
