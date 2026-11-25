import { calculateCommission, minimumOfferAmount } from './commission';

describe('calculateCommission', () => {
  it('takes 15% commission and 20% of that as tax', () => {
    expect(calculateCommission(100_000n)).toEqual({
      commissionAmount: 15_000n,
      commissionTaxAmount: 3_000n,
    });
  });

  it('rounds half up to a whole minor unit (no fractional kuruş)', () => {
    // 333 * 0.15 = 49.95 -> 50; 50 * 0.2 = 10
    expect(calculateCommission(333n)).toEqual({
      commissionAmount: 50n,
      commissionTaxAmount: 10n,
    });
    // 10 * 0.15 = 1.5 -> 2 (exactly half rounds up); 2 * 0.2 = 0.4 -> 0
    expect(calculateCommission(10n)).toEqual({
      commissionAmount: 2n,
      commissionTaxAmount: 0n,
    });
  });

  it('returns zero for a zero amount', () => {
    expect(calculateCommission(0n)).toEqual({
      commissionAmount: 0n,
      commissionTaxAmount: 0n,
    });
  });

  it('is exact above the old Int limit (50M offer that 500ed in production)', () => {
    expect(calculateCommission(5_000_000_000n)).toEqual({
      commissionAmount: 750_000_000n,
      commissionTaxAmount: 150_000_000n,
    });
  });

  it('is exact at MAX_SAFE_INTEGER, where float math would drift', () => {
    // 9_007_199_254_740_991 * 15 / 100 = 1_351_079_888_211_148.65 -> ...149
    // 1_351_079_888_211_149 * 20 / 100 = 270_215_977_642_229.8 -> ...230
    expect(calculateCommission(9_007_199_254_740_991n)).toEqual({
      commissionAmount: 1_351_079_888_211_149n,
      commissionTaxAmount: 270_215_977_642_230n,
    });
  });
});

describe('minimumOfferAmount', () => {
  it('applies the discount cap', () => {
    expect(minimumOfferAmount(100_000n, 40)).toBe(60_000n);
  });

  it('rounds up so the floor can never be undercut by a minor unit', () => {
    // 999 * 0.9 = 899.1 -> 900
    expect(minimumOfferAmount(999n, 10)).toBe(900n);
  });

  it('0% means full price, 100% means anything goes', () => {
    expect(minimumOfferAmount(12_345n, 0)).toBe(12_345n);
    expect(minimumOfferAmount(12_345n, 100)).toBe(0n);
  });

  it('is exact on very large prices', () => {
    expect(minimumOfferAmount(9_007_199_254_740_991n, 10)).toBe(
      8_106_479_329_266_892n,
    );
  });
});
