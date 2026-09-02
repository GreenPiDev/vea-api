import { Type, TypeOptions } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDefined, IsIn, IsNumber, Max, Min, ValidateNested } from 'class-validator';
import { GridCellDto, SpawnDto } from '../../exhibitions/dto/scene-config.dto';

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
