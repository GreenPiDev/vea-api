import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddArtworkToExhibitionDto } from './add-artwork-to-exhibition.dto';
import { ArtworkPositionDataDto } from './position-data.dto';

const base = { artworkId: 'artwork-1' };

describe('AddArtworkToExhibitionDto positionData', () => {
  it('accepts a valid positionData and instantiates ArtworkPositionDataDto', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      positionData: { wallRunId: 'wall-north' },
      order: 0,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.positionData).toBeInstanceOf(ArtworkPositionDataDto);
    expect(dto.order).toBe(0);
  });

  it('accepts a missing positionData (optional field)', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, { ...base });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects positionData missing wallRunId', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      positionData: {},
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'positionData')).toBe(true);
  });

  it('rejects a negative order (sibling top-level field, not part of positionData)', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      order: -1,
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'order')).toBe(true);
  });

  it('rejects a stray order field nested inside positionData (order only lives on the sibling top-level field)', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      positionData: { wallRunId: 'wall-north', order: 3 },
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((e) => e.property === 'positionData')).toBe(true);
  });

  it('accepts a positionData with an explicit heightY curator override', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      positionData: { wallRunId: 'wall-north', heightY: 2.1 },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.positionData).toBeInstanceOf(ArtworkPositionDataDto);
    expect(dto.positionData?.heightY).toBe(2.1);
  });

  it('accepts positionData without heightY (optional)', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      positionData: { wallRunId: 'wall-north' },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.positionData?.heightY).toBeUndefined();
  });

  it('rejects a negative heightY', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      positionData: { wallRunId: 'wall-north', heightY: -0.5 },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'positionData')).toBe(true);
  });

  it('rejects an unreasonably tall heightY', async () => {
    const dto = plainToInstance(AddArtworkToExhibitionDto, {
      ...base,
      positionData: { wallRunId: 'wall-north', heightY: 50 },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'positionData')).toBe(true);
  });
});
