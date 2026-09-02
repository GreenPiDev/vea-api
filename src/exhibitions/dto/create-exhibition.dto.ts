import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CustomSceneConfigDto,
  SCENE_CONFIG_TYPE_OPTIONS,
  TemplateSceneConfigDto,
} from './scene-config.dto';

export class CreateExhibitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  // Curator-set cap on how many artworks may ever be placed in this
  // exhibition at once (across all walls). Nullable = unlimited.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxArtworks?: number;

  // Optional "solo show" artist — see the field comment on the Exhibition
  // model. Service layer verifies this ArtistProfile belongs to the
  // caller's own Organization, same guard as artwork placement.
  @IsOptional()
  @IsString()
  artistProfileId?: string;

  // 3D scene layout data, stored as an opaque JSON column (no migration for
  // shape changes) but validated as a discriminated union — see scene-config.dto.ts.
  @IsOptional()
  @ValidateNested()
  @Type(() => Object, SCENE_CONFIG_TYPE_OPTIONS)
  sceneConfig?: TemplateSceneConfigDto | CustomSceneConfigDto;
}
