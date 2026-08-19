// %15 komisyon ve komisyonun %20'sinin vergi olarak ayrılması toplantı
// notlarından geliyor ama mali/hukuki olarak henüz doğrulanmadı — bkz.
// vea-api/CLAUDE.md "Netleştirilmesi gereken konular". Değişirse sadece bu
// dosya güncellenir; snapshot zaten geçmiş Offer kayıtlarını korur.
export const COMMISSION_RATE = 0.15;
export const COMMISSION_TAX_RATE = 0.2;

export function calculateCommission(amount: number) {
  const commissionAmount = Math.round(amount * COMMISSION_RATE);
  const commissionTaxAmount = Math.round(
    commissionAmount * COMMISSION_TAX_RATE,
  );
  return { commissionAmount, commissionTaxAmount };
}
