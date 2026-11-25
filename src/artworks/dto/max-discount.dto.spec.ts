import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MAX_DISCOUNT_PERCENT } from '../../common/discount';
import { CreateArtworkDto } from './create-artwork.dto';
import { UpdateArtworkDto } from './update-artwork.dto';

const validArtwork = {
  title: 'Eser',
  artistDisplayName: 'Sanatçı',
  heightCm: 50,
  widthCm: 40,
  orientation: 'PORTRAIT',
  framed: false,
  category: 'PAINTING',
  priceAmount: 100_000,
  currency: 'TRY',
  imageUrl: 'https://example.com/a.webp',
};

async function discountErrors(
  cls: typeof CreateArtworkDto | typeof UpdateArtworkDto,
  body: object,
) {
  const errors = await validate(plainToInstance(cls, body));
  return errors.filter((e) => e.property === 'maxDiscountPercent');
}

describe('maxDiscountPercent cap', () => {
  it('is 30 percent', () => {
    expect(MAX_DISCOUNT_PERCENT).toBe(30);
  });

  it.each([undefined, 0, 15, 30])('create accepts %p', async (value) => {
    expect(
      await discountErrors(CreateArtworkDto, {
        ...validArtwork,
        maxDiscountPercent: value,
      }),
    ).toHaveLength(0);
  });

  it.each([31, 50, 100])('create rejects %p', async (value) => {
    expect(
      await discountErrors(CreateArtworkDto, {
        ...validArtwork,
        maxDiscountPercent: value,
      }),
    ).toHaveLength(1);
  });

  it('create rejects a negative or fractional value', async () => {
    expect(
      await discountErrors(CreateArtworkDto, {
        ...validArtwork,
        maxDiscountPercent: -1,
      }),
    ).toHaveLength(1);
    expect(
      await discountErrors(CreateArtworkDto, {
        ...validArtwork,
        maxDiscountPercent: 10.5,
      }),
    ).toHaveLength(1);
  });

  it('update accepts 30 and rejects 31', async () => {
    expect(
      await discountErrors(UpdateArtworkDto, { maxDiscountPercent: 30 }),
    ).toHaveLength(0);
    expect(
      await discountErrors(UpdateArtworkDto, { maxDiscountPercent: 31 }),
    ).toHaveLength(1);
  });
});
