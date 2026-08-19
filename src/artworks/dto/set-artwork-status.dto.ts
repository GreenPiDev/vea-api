import { IsIn } from 'class-validator';

// Owner-settable statuses only. IN_EXHIBITION and SOLD are set by the
// exhibition/offer flows, never directly by the artist — see artworks.service.ts.
export const OWNER_SETTABLE_STATUSES = ['DRAFT', 'LISTED'] as const;

export class SetArtworkStatusDto {
  @IsIn(OWNER_SETTABLE_STATUSES)
  status: (typeof OWNER_SETTABLE_STATUSES)[number];
}
