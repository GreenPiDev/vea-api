import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateExhibitionDto } from './create-exhibition.dto';

// OmitType drops artistProfileId from the base before PartialType runs —
// it's redeclared below as nullable, which PartialType alone can't widen
// (Partial<string | undefined> still rejects an explicit `null`).
export class UpdateExhibitionDto extends PartialType(
  OmitType(CreateExhibitionDto, ['artistProfileId'] as const),
) {
  // Not on CreateExhibitionDto — an exhibition has no placed artworks yet
  // at creation time, so there's nothing to set as a cover until later.
  // @IsOptional() treats both undefined (key omitted — leave unchanged) and
  // null (explicit clear) as "skip validation", which is exactly the
  // tri-state ExhibitionsService.update relies on; any actual value still
  // has to be a string.
  @IsOptional()
  @IsString()
  coverArtworkId?: string | null;

  // Overrides CreateExhibitionDto's non-nullable `artistProfileId?: string`
  // — unlike at creation time, editing needs a way to explicitly clear a
  // solo-show artist back to "mixed/group show" (null), not just leave it
  // unchanged (undefined). Same tri-state as coverArtworkId above.
  @IsOptional()
  @IsString()
  artistProfileId?: string | null;
}
