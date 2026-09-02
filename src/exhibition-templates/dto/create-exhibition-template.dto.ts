import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CustomTextureIdsDto, HEX_COLOR } from '../../exhibitions/dto/scene-config.dto';
import { CustomRoomShapeDto, ROOM_SHAPE_TYPE_OPTIONS, RectangleRoomShapeDto } from './room-shape.dto';

// Same wall-height bounds as CustomSceneConfigDto's wallHeight, so a
// template can't be created with a room too short to stand in or absurdly
// tall. Room footprint bounds (4-60m) live in room-shape.dto.ts.
export class CreateExhibitionTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @ValidateNested()
  @Type(() => Object, ROOM_SHAPE_TYPE_OPTIONS)
  roomShape: RectangleRoomShapeDto | CustomRoomShapeDto;

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
}
