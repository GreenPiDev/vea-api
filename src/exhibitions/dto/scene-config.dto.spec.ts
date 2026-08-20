import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExhibitionDto } from './create-exhibition.dto';
import {
  TemplateSceneConfigDto,
  CustomSceneConfigDto,
} from './scene-config.dto';

const base = {
  title: 'Test Exhibition',
  startDate: '2026-09-01T00:00:00.000Z',
  endDate: '2026-09-30T00:00:00.000Z',
};

const validCustom = {
  kind: 'custom',
  cells: [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
  ],
  wallHeight: 4,
  wallColor: '#22303f',
  floorColor: '#141a22',
  ceilingColor: '#0f141b',
  spawn: { x: 0, z: 0, yaw: 0 },
};

describe('CreateExhibitionDto sceneConfig discriminated union', () => {
  it('accepts a valid template sceneConfig and instantiates the matching subtype', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: { kind: 'template', templateId: 'renaissance' },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.sceneConfig).toBeInstanceOf(TemplateSceneConfigDto);
  });

  it('accepts a valid custom sceneConfig and instantiates the matching subtype', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: validCustom,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.sceneConfig).toBeInstanceOf(CustomSceneConfigDto);
  });

  it('accepts a custom sceneConfig with optional textureIds', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: {
        ...validCustom,
        textureIds: { floor: 'oak-01', wall: 'plaster-02' },
      },
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a missing sceneConfig (optional field)', async () => {
    const dto = plainToInstance(CreateExhibitionDto, { ...base });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.sceneConfig).toBeUndefined();
  });

  it('rejects an unknown kind discriminator', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: { kind: 'freeform', templateId: 'renaissance' },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'sceneConfig')).toBe(true);
  });

  it('rejects a template sceneConfig missing templateId', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: { kind: 'template' },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'sceneConfig')).toBe(true);
  });

  it('rejects a custom sceneConfig with an empty cells array', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: { ...validCustom, cells: [] },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'sceneConfig')).toBe(true);
  });

  it('rejects a custom sceneConfig missing spawn', async () => {
    const { spawn: _spawn, ...withoutSpawn } = validCustom;
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: withoutSpawn,
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'sceneConfig')).toBe(true);
  });

  it('rejects a non-hex color value', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: { ...validCustom, wallColor: 'blue' },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'sceneConfig')).toBe(true);
  });

  it('rejects wallHeight outside the sane range', async () => {
    const dto = plainToInstance(CreateExhibitionDto, {
      ...base,
      sceneConfig: { ...validCustom, wallHeight: 100 },
    });

    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'sceneConfig')).toBe(true);
  });
});
