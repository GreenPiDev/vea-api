import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  // 3D scene layout data — shape isn't finalized yet (frontend-owned), so it's
  // stored as an opaque JSON blob rather than modeled field-by-field here.
  @IsOptional()
  @IsObject()
  sceneConfig?: Record<string, unknown>;
}
