import { IsNotEmpty, IsString } from 'class-validator';

export class RecordArtworkViewDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
