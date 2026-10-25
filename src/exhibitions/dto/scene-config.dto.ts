import { Type, TypeOptions } from 'class-transformer';
import {
  ArrayMaxSize,
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

// Shared by CustomSceneConfigDto and exhibition-templates/dto/room-shape.dto.ts's
// RectangleRoomShapeDto/CustomRoomShapeDto — same reasoning as GridCellDto/SpawnDto
// below. A room's curator-placed ceiling fixtures stay capped well under any
// realistic density (see vea-frontend's galleryLayout.ts auto-grid, which has
// always capped at 9 for FPS-budget reasons); 24 leaves real headroom for free
// placement while still bounding the stored array and the (purely cosmetic,
// no real light) disc count rendered per room.
export const MAX_CEILING_LIGHTS = 24;

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

/** A single curator-placed ceiling fixture position, room-local meters (same coordinate space as GridCellDto/SpawnDto). Y is never stored — vea-frontend's galleryLayout.ts always hangs it at wallHeight - 0.1, same as the auto-grid it replaces. */
export class CeilingLightDto {
  @IsNumber()
  @Min(-100)
  @Max(100)
  x: number;

  @IsNumber()
  @Min(-100)
  @Max(100)
  z: number;
}

// Shared by exhibition-templates/dto/room-shape.dto.ts's RectangleRoomShapeDto/
// CustomRoomShapeDto — same "cosmetic, no wallRunId derivation" reasoning as
// CeilingLightDto above, so a template's room-shape lock (see
// ExhibitionTemplatesService's shapeChanged) never looks at this field either.
// Capped well above any realistic single-room furniture count while still
// bounding the stored array and the per-room model-instance count rendered.
export const MAX_FURNITURE_PER_ROOM = 20;

/** A single curator-placed furniture piece, room-local meters (same coordinate space as GridCellDto/SpawnDto/CeilingLightDto). `furnitureId` picks a model from vea-frontend's furniture.ts FURNITURE_CATALOG — not validated against that list here, same approach as TemplateSceneConfigDto's templateId (frontend-owned data). */
export class FurniturePlacementDto {
  @IsString()
  furnitureId: string;

  @IsNumber()
  @Min(-100)
  @Max(100)
  x: number;

  @IsNumber()
  @Min(-100)
  @Max(100)
  z: number;

  /** Yaw in radians, same convention as SpawnDto.yaw: 0 = north (-Z), PI = south (+Z), PI/2 = west (-X), -PI/2 = east (+X). */
  @IsNumber()
  rotationY: number;
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

  // Curator-placed ceiling fixtures (see CeilingLightDto). Omitted/empty — every
  // exhibition created before this field existed — falls back to galleryLayout.ts's
  // auto-generated grid, unchanged.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CEILING_LIGHTS)
  @ValidateNested({ each: true })
  @Type(() => CeilingLightDto)
  ceilingLights?: CeilingLightDto[];
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
