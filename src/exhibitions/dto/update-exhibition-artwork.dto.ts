import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { ArtworkPositionDataDto } from './position-data.dto';

export class UpdateExhibitionArtworkDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ArtworkPositionDataDto)
  positionData?: ArtworkPositionDataDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
