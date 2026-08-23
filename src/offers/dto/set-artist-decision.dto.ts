import { IsEnum } from 'class-validator';
import { ArtistDecision } from '@prisma/client';

export class SetArtistDecisionDto {
  @IsEnum(ArtistDecision)
  decision: ArtistDecision;
}
