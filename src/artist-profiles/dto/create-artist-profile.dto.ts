import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateArtistProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  institutionName?: string;
}
