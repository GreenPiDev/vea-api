import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export type RemovalDecision = 'APPROVED' | 'REJECTED';

export class DecideRemovalRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  decision: RemovalDecision;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  responseMessage: string;
}
