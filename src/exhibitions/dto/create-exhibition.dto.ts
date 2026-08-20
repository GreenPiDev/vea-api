import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
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

  // 3D scene layout data, stored as an opaque JSON column (no migration for
  // shape changes) but validated as a discriminated union — see scene-config.dto.ts.
  @IsOptional()
  @ValidateNested()
  @Type(() => Object, SCENE_CONFIG_TYPE_OPTIONS)
  sceneConfig?: TemplateSceneConfigDto | CustomSceneConfigDto;
}
