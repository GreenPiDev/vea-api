// Allow-listed here (app layer) rather than as a Prisma enum, so adding a new
// supported currency never requires a migration — see vea-api/CLAUDE.md.
export const SUPPORTED_CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
