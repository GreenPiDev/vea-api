import {
  ArtworkCategory,
  ArtworkConditionStatus,
  ArtworkOrientation,
} from '@prisma/client';
import {
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

  @IsIn(SUPPORTED_CURRENCIES)
  currency: SupportedCurrency;

  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsUrl()
  model3dUrl?: string;
}
