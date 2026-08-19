import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class AddArtworkToExhibitionDto {
  @IsString()
  artworkId: string;

  @IsOptional()
  @IsObject()
  positionData?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
