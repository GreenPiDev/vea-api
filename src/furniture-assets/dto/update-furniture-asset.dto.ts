import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// Deliberately not a PartialType(CreateFurnitureAssetDto): modelUrl/
// thumbnailUrl/nativeWidth/nativeDepth are fixed at upload time (the model
// file itself and its own measured bounding box never change post-create)
// — only name and the uniform `scale` knob are ever editable afterward.
export class UpdateFurnitureAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  scale?: number;
}
