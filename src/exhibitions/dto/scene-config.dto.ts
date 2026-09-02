import { Type, TypeOptions } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Exhibition.sceneConfig stays an opaque Json column (no migration for shape
 * changes), but is validated here as a discriminated union matching the
 * decisions in the project_frontend_integration_roadmap memory (2026-08-19):
 *
 * - "template": picks one of vea-frontend's curated room presets (see
 *   src/components/3d/exhibitions.ts's EXHIBITIONS — 4 exist today, more are
 *   planned) by id. Room size/wall height/color theme all live in that
 *   frontend registry, not here — the backend only stores which preset was
 *   chosen.
 * - "custom": a user-drawn footprint (src/components/3d/galleryLayout.ts's
 *   buildCustomRoomLayout input), mirroring CustomExhibitionSource minus its
 *   `name`/`placements` (title lives on Exhibition.title, placements live on
 *   ExhibitionArtwork.positionData below).
 */

// Exported so exhibition-templates/dto/create-exhibition-template.dto.ts can
// validate its own wallColor/floorColor/ceilingColor/textureIds fields the
// same way CustomSceneConfigDto does, without duplicating the regex/DTO.
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// GridCellDto/SpawnDto are also reused by exhibition-templates/dto/room-shape.dto.ts
// (a template's "custom" room shape is drawn with the exact same grid UI as
// a custom exhibition room) — exported so that module doesn't redefine them.
export class GridCellDto {
  @IsNumber()
  x: number;

  @IsNumber()
  z: number;
}

/** User-chosen spawn cell + facing, overriding the automatic centroid-nearest pick (galleryLayout.ts's SpawnOverride). */
export class SpawnDto {
  @IsNumber()
  x: number;

  @IsNumber()
  z: number;

  /** Yaw in radians: 0 = north (-Z), PI = south (+Z), PI/2 = west (-X), -PI/2 = east (+X). */
  @IsNumber()
  yaw: number;
}

/** Optional real-photo PBR texture ids (see vea-frontend's surfaceTextures.ts) — override the flat colors when set. */
export class CustomTextureIdsDto {
  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  wall?: string;

  @IsOptional()
  @IsString()
  ceiling?: string;
}

export class TemplateSceneConfigDto {
  @IsIn(['template'])
  kind: 'template';

  /** Id of a preset room in vea-frontend's EXHIBITIONS registry (e.g. "renaissance"). Not validated against that list here — frontend-owned data. */
  @IsString()
  templateId: string;
}

export class CustomSceneConfigDto {
  @IsIn(['custom'])
  kind: 'custom';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GridCellDto)
  cells: GridCellDto[];

  @IsNumber()
  @Min(2)
  @Max(20)
  wallHeight: number;

  @Matches(HEX_COLOR)
  wallColor: string;

  @Matches(HEX_COLOR)
  floorColor: string;

  @Matches(HEX_COLOR)
  ceilingColor: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomTextureIdsDto)
  textureIds?: CustomTextureIdsDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SpawnDto)
  spawn: SpawnDto;
}

export type SceneConfigDto = TemplateSceneConfigDto | CustomSceneConfigDto;

/** Shared class-transformer discriminator config for the sceneConfig field — reused by create/update DTOs. */
export const SCENE_CONFIG_TYPE_OPTIONS: TypeOptions = {
  discriminator: {
    property: 'kind',
    subTypes: [
      { value: TemplateSceneConfigDto, name: 'template' },
      { value: CustomSceneConfigDto, name: 'custom' },
    ],
  },
  keepDiscriminatorProperty: true,
};
