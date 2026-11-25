import { bigintJsonReplacer, toSafeNumber } from './bigint-json';

describe('bigint JSON serialization', () => {
  it('serializes nested bigints as plain JSON numbers', () => {
    const body = {
      priceAmount: 5_000_000_000n,
      offers: [{ amount: 1n, commissionAmount: null }],
      title: 'x',
    };
    expect(JSON.parse(JSON.stringify(body, bigintJsonReplacer))).toEqual({
      priceAmount: 5_000_000_000,
      offers: [{ amount: 1, commissionAmount: null }],
      title: 'x',
    });
  });

  it('converts MAX_SAFE_INTEGER exactly', () => {
    expect(toSafeNumber(9_007_199_254_740_991n)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('refuses to silently lose precision beyond the safe range', () => {
    expect(() => toSafeNumber(9_007_199_254_740_992n)).toThrow(RangeError);
  });
});
