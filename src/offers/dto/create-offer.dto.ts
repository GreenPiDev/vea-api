import { IsInt, IsPositive } from 'class-validator';

// currency is intentionally NOT accepted here — it is always copied
// server-side from Artwork.currency at creation time (see offers.service.ts).
// Trusting a client-supplied currency would let a buyer mismatch it against
// the artwork's actual listed currency.
export class CreateOfferDto {
  @IsInt()
  @IsPositive()
  amount: number;
}
