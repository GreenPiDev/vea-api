import {
  ArtworkCategory,
  ArtworkConditionStatus,
  ArtworkOrientation,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SUPPORTED_CURRENCIES } from '../../common/currencies';
import type { SupportedCurrency } from '../../common/currencies';

export class CreateArtworkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  technique?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(new Date().getFullYear())
  yearCreated?: number;

  @IsPositive()
  heightCm: number;

  @IsPositive()
  widthCm: number;

  @IsEnum(ArtworkOrientation)
  orientation: ArtworkOrientation;

  // Whether the artist's uploaded image already includes its own physical
  // frame. false means the 3D scene adds a default modern-black frame mesh
  // around the canvas (see vea-frontend's Artwork.tsx/backendAdapter.ts);
  // true means we render the image as-is and just say "framed" in the
  // artwork detail card, trusting the photo already shows a frame.
  @IsBoolean()
  framed: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  story?: string;

  @IsOptional()
  @IsEnum(ArtworkConditionStatus)
  conditionStatus?: ArtworkConditionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditionNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsEnum(ArtworkCategory)
  category: ArtworkCategory;

  @IsInt()
  @IsPositive()
  priceAmount: number;

  // Whole-percent cap on how far a buyer's offer may undercut priceAmount —
  // omitted/undefined means no floor (see Artwork.maxDiscountPercent's
  // schema comment for the enforcement side, in OffersService.create).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxDiscountPercent?: number;

  @IsIn(SUPPORTED_CURRENCIES)
  currency: SupportedCurrency;

  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsUrl()
  model3dUrl?: string;
}
