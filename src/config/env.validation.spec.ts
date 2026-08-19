import { validate } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'test-secret',
};

describe('validate (env)', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    const result = validate(base);

    expect(result.DATABASE_URL).toBe(base.DATABASE_URL);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.JWT_EXPIRES_IN).toBe('7d');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validate({ JWT_SECRET: base.JWT_SECRET })).toThrow();
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => validate({ DATABASE_URL: base.DATABASE_URL })).toThrow();
  });

  it('throws when NODE_ENV has an unrecognized value', () => {
    expect(() => validate({ ...base, NODE_ENV: 'staging' })).toThrow();
  });

  it('coerces a numeric PORT string to a number', () => {
    const result = validate({ ...base, PORT: '4000' });

    expect(result.PORT).toBe(4000);
  });
});
