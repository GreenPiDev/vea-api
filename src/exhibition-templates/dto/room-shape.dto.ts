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
  GridCellDto,
  MAX_CEILING_LIGHTS,
  SpawnDto,
} from '../../exhibitions/dto/scene-config.dto';

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
