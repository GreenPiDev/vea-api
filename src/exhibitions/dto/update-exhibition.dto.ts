import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateExhibitionDto } from './create-exhibition.dto';

export class UpdateExhibitionDto extends PartialType(CreateExhibitionDto) {
  // Not on CreateExhibitionDto — an exhibition has no placed artworks yet
  // at creation time, so there's nothing to set as a cover until later.
  // @IsOptional() treats both undefined (key omitted — leave unchanged) and
  // null (explicit clear) as "skip validation", which is exactly the
  // tri-state ExhibitionsService.update relies on; any actual value still
  // has to be a string.
  @IsOptional()
  @IsString()
  coverArtworkId?: string | null;
}
