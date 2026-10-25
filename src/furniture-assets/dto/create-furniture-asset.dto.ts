import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// nativeWidth/nativeDepth are measured client-side from the uploaded model's
// own bounding box (see vea-frontend's loadGltfBoundingBox.ts) — this range
// just guards against a garbage/zero/absurd measurement, same spirit as
// exhibition-templates' room width/depth bounds.
export class CreateFurnitureAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  modelUrl: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsNumber()
  @Min(0.05)
  @Max(10)
  nativeWidth: number;

  @IsNumber()
  @Min(0.05)
  @Max(10)
  nativeDepth: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  scale?: number;
}
