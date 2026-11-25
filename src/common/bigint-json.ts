// Money columns are Postgres BIGINT (Prisma `bigint` in TS) — but JSON has no
// bigint and JSON.stringify throws on one. The API keeps sending plain JSON
// numbers (so the frontend's `number` types don't change): every amount is
// capped at Number.MAX_SAFE_INTEGER minor units on input (≈ 90 trillion in a
// 2-decimal currency), so it always converts back exactly.

export function toSafeNumber(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    // Never silently lose precision on a money value.
    throw new RangeError(`bigint ${value} exceeds the safe JSON number range`);
  }
  return Number(value);
}

// Registered as Express's 'json replacer' in main.ts, so every HTTP response
// body (res.json, which Nest uses for objects) serializes bigints as numbers.
// Not used for Prisma Json columns or Socket.IO payloads — convert those
// explicitly with toSafeNumber where an amount is put into them.
export function bigintJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? toSafeNumber(value) : value;
}
