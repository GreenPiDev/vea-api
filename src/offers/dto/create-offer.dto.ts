import { IsInt, IsPositive, Max } from 'class-validator';

// currency is intentionally NOT accepted here — it is always copied
// server-side from Artwork.currency at creation time (see offers.service.ts).
// Trusting a client-supplied currency would let a buyer mismatch it against
// the artwork's actual listed currency.
export class CreateOfferDto {
  // Minor units. Stored as BIGINT; capped at MAX_SAFE_INTEGER so a JSON
  // number round-trips exactly (larger values already lose precision when
  // the request body is parsed) — see common/bigint-json.ts.
  @IsInt()
  @IsPositive()
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;
}
