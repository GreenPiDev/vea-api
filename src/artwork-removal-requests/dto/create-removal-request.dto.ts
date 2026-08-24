import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRemovalRequestDto {
  @IsString()
  artworkId: string;

  @IsString()
  exhibitionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;
}
