import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpdateExhibitionArtworkDto {
  @IsOptional()
  @IsObject()
  positionData?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
