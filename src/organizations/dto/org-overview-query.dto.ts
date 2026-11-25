import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { ExhibitionStatus, OfferStatus } from '@prisma/client';
import { PagedQueryDto } from '../../common/pagination/paged-query.dto';

// Filters for the SUPERADMIN organization detail page's lists. Paging and
// `search` come from the shared PagedQueryDto; each list adds only its own
// filters here. Values are mirrored by hand in vea-frontend's
// lib/api/domains/organizations.ts.

export const OFFER_DECISION_FILTERS = ['APPROVED', 'REJECTED', 'NONE'] as const;
export type OfferDecisionFilter = (typeof OFFER_DECISION_FILTERS)[number];

/** search: artwork title, credited artist name, artist profile name, buyer email. */
export class OrgOffersQueryDto extends PagedQueryDto {
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  /** NONE = the artist hasn't recorded a decision yet. */
  @IsOptional()
  @IsIn(OFFER_DECISION_FILTERS)
  decision?: OfferDecisionFilter;
}

export const EXHIBITION_DELETED_FILTERS = ['exclude', 'only'] as const;
export type ExhibitionDeletedFilter =
  (typeof EXHIBITION_DELETED_FILTERS)[number];

/** search: exhibition title, curator email, solo-show artist name. */
export class OrgExhibitionsQueryDto extends PagedQueryDto {
  @IsOptional()
  @IsEnum(ExhibitionStatus)
  status?: ExhibitionStatus;

  /** Omitted = both live and soft-deleted exhibitions. */
  @IsOptional()
  @IsIn(EXHIBITION_DELETED_FILTERS)
  deleted?: ExhibitionDeletedFilter;
}

export const ARTIST_SHOW_FILTERS = ['pending-offers', 'no-profile'] as const;
export type ArtistShowFilter = (typeof ARTIST_SHOW_FILTERS)[number];

/** search: artist display name, email. */
export class OrgArtistsQueryDto extends PagedQueryDto {
  @IsOptional()
  @IsIn(ARTIST_SHOW_FILTERS)
  show?: ArtistShowFilter;
}
