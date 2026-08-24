import { IsOptional, IsString, MaxLength } from 'class-validator';

// Only `bio` is editable post-creation — displayName/institutionName are
// deliberately not included here (institutionName in particular now mirrors
// the inviting org, see ArtistProfilesService.updateBio's comment).
export class UpdateArtistProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;
}
