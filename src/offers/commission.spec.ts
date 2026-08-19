import { calculateCommission } from './commission';

describe('calculateCommission', () => {
  it('takes 15% commission and 20% of that as tax', () => {
    const result = calculateCommission(100_000);
    expect(result.commissionAmount).toBe(15_000);
    expect(result.commissionTaxAmount).toBe(3_000);
  });

  it('rounds to the nearest whole minor unit (no fractional kuruş)', () => {
    const result = calculateCommission(333);
    expect(Number.isInteger(result.commissionAmount)).toBe(true);
    expect(Number.isInteger(result.commissionTaxAmount)).toBe(true);
  });

  it('returns zero for a zero amount', () => {
    expect(calculateCommission(0)).toEqual({
      commissionAmount: 0,
      commissionTaxAmount: 0,
    });
  });
});
