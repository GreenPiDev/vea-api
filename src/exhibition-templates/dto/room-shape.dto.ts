import { Type, TypeOptions } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CeilingLightDto,
  FurniturePlacementDto,
  GridCellDto,
  MAX_CEILING_LIGHTS,
  MAX_FURNITURE_PER_ROOM,
  MAX_WINDOWS_PER_ROOM,
  OutdoorDto,
  SpawnDto,
  WindowPlacementDto,
} from '../../exhibitions/dto/scene-config.dto';

// A mezzanine (asma kat) along one whole wall of a rectangle room, with a straight stair landing at one end of
// its free edge — mirrors vea-frontend's MezzanineData (exhibitionTemplates.ts); the frontend's
// mezzanineTemplate.ts builds the geometry and applies the finer fit rules (open hall, headroom, stair room).
// Unlike windows/furniture it defines walls artworks hang on ("<wall>@mezz" wallRunIds), so it's part of the
// template's shape lock (shapeChanged).
export const MEZZANINE_WALL_IDS = ['north', 'south', 'east', 'west'] as const;

export class MezzanineDto {
  @IsIn(MEZZANINE_WALL_IDS)
  wallId: (typeof MEZZANINE_WALL_IDS)[number];

  @IsNumber()
  @Min(2)
  @Max(8)
  depth: number;

  /** Walk-surface height (m). */
  @IsNumber()
  @Min(2.8)
  @Max(12)
  top: number;

  @IsIn(['start', 'end'])
  stairEnd: 'start' | 'end';
}

/**
 * ExhibitionTemplate.roomShape, validated as a discriminated union — same
 * spirit as scene-config.dto.ts's TemplateSceneConfigDto/CustomSceneConfigDto,
 * reusing its GridCellDto/SpawnDto so a template's "custom" shape is defined
 * by the exact same grid drawing contract as a custom exhibition room
 * (galleryLayout.ts's buildCustomRoomLayout).
 */
export class RectangleRoomShapeDto {
  @IsIn(['rectangle'])
  kind: 'rectangle';

  @IsNumber()
  @Min(4)
  @Max(60)
  width: number;

  @IsNumber()
  @Min(4)
  @Max(60)
  depth: number;

  // Curator-placed ceiling fixtures — see CeilingLightDto. Omitted/empty falls back
  // to vea-frontend's galleryLayout.ts auto-generated grid, unchanged.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CEILING_LIGHTS)
  @ValidateNested({ each: true })
  @Type(() => CeilingLightDto)
  ceilingLights?: CeilingLightDto[];

  // Curator-placed furniture — see FurniturePlacementDto. Omitted/empty falls
  // back to no furniture at all (every template created before this field
  // existed), unchanged.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FURNITURE_PER_ROOM)
  @ValidateNested({ each: true })
  @Type(() => FurniturePlacementDto)
  furniture?: FurniturePlacementDto[];

  // Windows + outdoor view — see WindowPlacementDto/OutdoorDto. Omitted = a closed room (every template
  // created before this field existed), unchanged.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WINDOWS_PER_ROOM)
  @ValidateNested({ each: true })
  @Type(() => WindowPlacementDto)
  windows?: WindowPlacementDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OutdoorDto)
  outdoor?: OutdoorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MezzanineDto)
  mezzanine?: MezzanineDto;

  // Where (room-local meters, origin at the room centre) and facing which way the visitor enters.
  // Omitted = vea-frontend's galleryLayout.ts default (2 m in front of the south wall, facing north);
  // the frontend clamps it inside the walls. Not part of shapeChanged — it moves no wall artworks hang on.
  @IsOptional()
  @ValidateNested()
  @Type(() => SpawnDto)
  spawn?: SpawnDto;
}

export class CustomRoomShapeDto {
  @IsIn(['custom'])
  kind: 'custom';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GridCellDto)
  cells: GridCellDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => SpawnDto)
  spawn: SpawnDto;

  // Curator-placed ceiling fixtures — see CeilingLightDto. Omitted/empty falls back
  // to vea-frontend's galleryLayout.ts auto-generated grid, unchanged.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CEILING_LIGHTS)
  @ValidateNested({ each: true })
  @Type(() => CeilingLightDto)
  ceilingLights?: CeilingLightDto[];

  // Curator-placed furniture — see FurniturePlacementDto. Omitted/empty falls
  // back to no furniture at all (every template created before this field
  // existed), unchanged.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_FURNITURE_PER_ROOM)
  @ValidateNested({ each: true })
  @Type(() => FurniturePlacementDto)
  furniture?: FurniturePlacementDto[];

  // Windows + outdoor view — see WindowPlacementDto/OutdoorDto. Omitted = a closed room (every template
  // created before this field existed), unchanged.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WINDOWS_PER_ROOM)
  @ValidateNested({ each: true })
  @Type(() => WindowPlacementDto)
  windows?: WindowPlacementDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OutdoorDto)
  outdoor?: OutdoorDto;
}

export type RoomShapeDto = RectangleRoomShapeDto | CustomRoomShapeDto;

export const ROOM_SHAPE_TYPE_OPTIONS: TypeOptions = {
  discriminator: {
    property: 'kind',
    subTypes: [
      { value: RectangleRoomShapeDto, name: 'rectangle' },
      { value: CustomRoomShapeDto, name: 'custom' },
    ],
  },
  keepDiscriminatorProperty: true,
};
