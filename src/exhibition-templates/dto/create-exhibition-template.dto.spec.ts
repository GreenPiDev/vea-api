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
        furniture: [
          { furnitureId: 'antique-canape', x: 0, z: 0, rotationY: 1.5708 },
        ],
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
        furniture: [
          { furnitureId: 'antique-canape', x: 0.5, z: 0.5, rotationY: 0 },
        ],
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

describe('CreateExhibitionTemplateDto roomShape windows + outdoor', () => {
  const windows = [
    {
      id: 'n0',
      wallId: 'north',
      alongFraction: 0.5,
      width: 4.5,
      height: 4.2,
      sillHeight: 0,
      styleId: 'panorama',
    },
  ];

  it.each(['rectangle', 'custom'] as const)(
    'accepts windows and an outdoor view on a %s room shape',
    async (kind) => {
      const shape =
        kind === 'rectangle'
          ? { kind, width: 14, depth: 10 }
          : { kind, cells: [{ x: 0, z: 0 }], spawn: { x: 0, z: 0, yaw: 0 } };
      const dto = plainToInstance(CreateExhibitionTemplateDto, {
        ...base,
        roomShape: { ...shape, windows, outdoor: { panoramaId: 'seaside' } },
      });

      const errors = await validate(dto, { whitelist: true });

      expect(errors).toHaveLength(0);
      expect((dto.roomShape as { windows?: unknown[] }).windows).toHaveLength(
        1,
      );
    },
  );

  it('rejects an outdoor view without a panoramaId', async () => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: {
        kind: 'rectangle',
        width: 14,
        depth: 10,
        outdoor: { rotationY: 1 },
      },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'roomShape')).toBe(true);
  });
});

describe('CreateExhibitionTemplateDto roomShape.mezzanine', () => {
  const mezzanine = { wallId: 'north', depth: 4, top: 3.6, stairEnd: 'end' };

  it('accepts a rectangle room with a mezzanine and furniture on it', async () => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      wallHeight: 7,
      roomShape: {
        kind: 'rectangle',
        width: 16,
        depth: 12,
        mezzanine,
        furniture: [
          { furnitureId: 'bench', x: 0, z: -4, rotationY: 0, level: 1 },
        ],
      },
    });

    const errors = await validate(dto, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect((dto.roomShape as { mezzanine?: unknown }).mezzanine).toEqual(
      mezzanine,
    );
  });

  it.each([
    ['an unknown wall', { wallId: 'up' }],
    ['a too shallow slab', { depth: 1 }],
    ['a too low slab', { top: 2 }],
    ['an unknown stair end', { stairEnd: 'middle' }],
  ])('rejects %s', async (_label, patch) => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: {
        kind: 'rectangle',
        width: 16,
        depth: 12,
        mezzanine: { ...mezzanine, ...patch },
      },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'roomShape')).toBe(true);
  });

  it('rejects a furniture level other than 0/1', async () => {
    const dto = plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: {
        kind: 'rectangle',
        width: 16,
        depth: 12,
        furniture: [
          { furnitureId: 'bench', x: 0, z: 0, rotationY: 0, level: 2 },
        ],
      },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'roomShape')).toBe(true);
  });
});

describe('CreateExhibitionTemplateDto roomShape.spawn (rectangle)', () => {
  const rect = (spawn: unknown) =>
    plainToInstance(CreateExhibitionTemplateDto, {
      ...base,
      roomShape: { kind: 'rectangle', width: 24, depth: 20, spawn },
    });

  it('keeps an optional spawn point on a rectangle room', async () => {
    const dto = rect({ x: 8, z: 0, yaw: Math.PI / 2 });

    expect(await validate(dto)).toHaveLength(0);
    expect((dto.roomShape as { spawn?: unknown }).spawn).toEqual({
      x: 8,
      z: 0,
      yaw: Math.PI / 2,
    });
  });

  it('rejects a malformed spawn point', async () => {
    const errors = await validate(rect({ x: 'a', z: 0 }));

    expect(errors.length).toBeGreaterThan(0);
  });
});
