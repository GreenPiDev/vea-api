// %15 komisyon ve komisyonun %20'sinin vergi olarak ayrılması toplantı
// notlarından geliyor ama mali/hukuki olarak henüz doğrulanmadı — bkz.
// vea-api/CLAUDE.md "Netleştirilmesi gereken konular". Değişirse sadece bu
// dosya güncellenir; snapshot zaten geçmiş Offer kayıtlarını korur.
//
// Rates are basis points (1/100 of a percent) and the math is exact bigint
// integer arithmetic — no float multiplication, so there's no rounding drift
// on large amounts or at .5 boundaries (0.15 isn't exactly representable as
// a float).
export const COMMISSION_RATE_BPS = 1500n; // %15
export const COMMISSION_TAX_RATE_BPS = 2000n; // komisyonun %20'si

const BPS_DENOMINATOR = 10_000n;

// value × bps / 10000, rounded half up (amounts are never negative) — the
// same rounding Math.round gave before, minus the float error.
function applyRate(value: bigint, bps: bigint): bigint {
  return (value * bps + BPS_DENOMINATOR / 2n) / BPS_DENOMINATOR;
}

export function calculateCommission(amount: bigint) {
  const commissionAmount = applyRate(amount, COMMISSION_RATE_BPS);
  const commissionTaxAmount = applyRate(
    commissionAmount,
    COMMISSION_TAX_RATE_BPS,
  );
  return { commissionAmount, commissionTaxAmount };
}

// Lowest offer the artist's maxDiscountPercent allows:
// priceAmount × (100 − pct) / 100, rounded UP so a buyer can never get even
// one minor unit below the artist's floor.
export function minimumOfferAmount(
  priceAmount: bigint,
  maxDiscountPercent: number,
): bigint {
  const numerator = priceAmount * BigInt(100 - maxDiscountPercent);
  return (numerator + 99n) / 100n;
}
