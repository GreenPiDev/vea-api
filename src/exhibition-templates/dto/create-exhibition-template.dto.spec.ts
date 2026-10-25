import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExhibitionTemplateDto } from './create-exhibition-template.dto';

const base = {
  name: 'Rönesans',
  wallHeight: 6,
  wallColor: '#efe4cf',
  floorColor: '#8a6a45',
  ceilingColor: '#f7f0e0',
};

describe('CreateExhibitionTemplateDto roomShape.furniture', () => {
  it('accepts a rectangle roomShape with valid furniture placements', async () => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: {
        kind: 'rectangle',
        width: 14,
        depth: 10,
        furniture: [{ furnitureId: 'antique-canape', x: 0, z: 0, rotationY: 1.5708 }],
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a custom roomShape with valid furniture placements', async () => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: {
        kind: 'custom',
        cells: [{ x: 0, z: 0 }],
        spawn: { x: 0, z: 0, yaw: 0 },
        furniture: [{ furnitureId: 'antique-canape', x: 0.5, z: 0.5, rotationY: 0 }],
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a roomShape with no furniture at all (field omitted)', async () => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: { kind: 'rectangle', width: 14, depth: 10 },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a furniture placement missing furnitureId', async () => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: {
        kind: 'rectangle',
        width: 14,
        depth: 10,
        furniture: [{ x: 0, z: 0, rotationY: 0 }],
      },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'roomShape')).toBe(true);
  });

  it('rejects more furniture placements than MAX_FURNITURE_PER_ROOM', async () => {
    const furniture = Array.from({ length: 21 }, (_, i) => ({
      furnitureId: 'antique-canape',
      x: i,
      z: 0,
      rotationY: 0,
    }));
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: { kind: 'rectangle', width: 14, depth: 10, furniture },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'roomShape')).toBe(true);
  });
});
