import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 100;

// Shared query shape for every server-side paginated + searchable list
// (page-based, returns a total — see paginate.ts). An endpoint adds its own
// filters by extending this class, e.g. OrgOffersQueryDto. Not the older
// take/skip PaginationQueryDto, which plain array endpoints still use.
export class PagedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;

  // Trimmed; an empty/whitespace-only value means "no search".
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  search?: string;
}
