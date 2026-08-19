import { validate } from './env.validation';

describe('validate (env)', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    const result = validate({ DATABASE_URL: 'postgresql://user:pass@localhost:5432/db' });

    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validate({})).toThrow();
  });

  it('throws when NODE_ENV has an unrecognized value', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NODE_ENV: 'staging',
      }),
    ).toThrow();
  });

  it('coerces a numeric PORT string to a number', () => {
    const result = validate({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      PORT: '4000',
    });

    expect(result.PORT).toBe(4000);
  });
});
