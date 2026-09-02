import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExhibitionTemplatesService } from './exhibition-templates.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExhibitionTemplatesService', () => {
  const ownerOrgId = 'org-owner';
  const otherOrgId = 'org-other';

  let prisma: {
    exhibitionTemplate: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
  };
  let service: ExhibitionTemplatesService;

  const template = (overrides: Record<string, unknown> = {}) => ({
    id: 'template-1',
    organizationId: ownerOrgId,
    name: 'Rönesans',
    subtitle: null,
    roomShape: { kind: 'rectangle', width: 14, depth: 10 },
    wallHeight: 6,
    wallColor: '#efe4cf',
    floorColor: '#8a6a45',
    ceilingColor: '#f7f0e0',
    floorTextureId: null,
    wallTextureId: null,
    ceilingTextureId: null,
    _count: { exhibitions: 0 },
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      exhibitionTemplate: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
    };
    service = new ExhibitionTemplatesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects an admin with no organizationId', () => {
      expect(() =>
        service.create(null, {
          name: 'x',
          roomShape: { kind: 'rectangle', width: 10, depth: 10 },
          wallHeight: 6,
          wallColor: '#111111',
          floorColor: '#222222',
          ceilingColor: '#333333',
        }),
      ).toThrow(ForbiddenException);
    });

    it('derives and stores the full theme from the 3 picked colors, and stores roomShape as-is', async () => {
      const roomShape = { kind: 'rectangle' as const, width: 14, depth: 10 };
      await service.create(ownerOrgId, {
        name: 'Rönesans',
        roomShape,
        wallHeight: 6,
        wallColor: '#efe4cf',
        floorColor: '#8a6a45',
        ceilingColor: '#f7f0e0',
      });
      const data = prisma.exhibitionTemplate.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe(ownerOrgId);
      expect(data.roomShape).toEqual(roomShape);
      expect(data.theme).toMatchObject({
        wallColor: '#efe4cf',
        floorColor: '#8a6a45',
        ceilingColor: '#f7f0e0',
        fogColor: '#8a6a45',
        backgroundColor: '#efe4cf',
      });
    });

    it('accepts a custom (grid-drawn) room shape unchanged', async () => {
      const roomShape = {
        kind: 'custom' as const,
        cells: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
        spawn: { x: 0, z: 0, yaw: 0 },
      };
      await service.create(ownerOrgId, {
        name: 'Özel',
        roomShape,
        wallHeight: 6,
        wallColor: '#efe4cf',
        floorColor: '#8a6a45',
        ceilingColor: '#f7f0e0',
      });
      const data = prisma.exhibitionTemplate.create.mock.calls[0][0].data;
      expect(data.roomShape).toEqual(roomShape);
    });
  });

  describe('findOwn', () => {
    it('returns an empty list for an admin with no organizationId, without querying the DB', async () => {
      const result = await service.findOwn(null);
      expect(result).toEqual([]);
      expect(prisma.exhibitionTemplate.findMany).not.toHaveBeenCalled();
    });

    it('scopes to organizationId and includes the exhibitions usage count', async () => {
      await service.findOwn(ownerOrgId);
      const args = prisma.exhibitionTemplate.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ organizationId: ownerOrgId });
      expect(args.include).toEqual({ _count: { select: { exhibitions: true } } });
    });
  });

  describe('ownership', () => {
    it('findOneOwn throws NotFoundException for a missing template', async () => {
      prisma.exhibitionTemplate.findUnique.mockResolvedValue(null);
      await expect(service.findOneOwn('missing', ownerOrgId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('findOneOwn throws ForbiddenException for a template owned by another organization', async () => {
      prisma.exhibitionTemplate.findUnique.mockResolvedValue(template());
      await expect(service.findOneOwn('template-1', otherOrgId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('update re-derives theme from merged colors when only one color changes', async () => {
      prisma.exhibitionTemplate.findUnique.mockResolvedValue(template());
      await service.update('template-1', ownerOrgId, { wallColor: '#000000' });
      const data = prisma.exhibitionTemplate.update.mock.calls[0][0].data;
      expect(data.wallColor).toBe('#000000');
      expect(data.floorColor).toBe('#8a6a45');
      expect(data.theme).toMatchObject({
        wallColor: '#000000',
        floorColor: '#8a6a45',
        backgroundColor: '#000000',
      });
    });

    it('rejects a room shape change once the template is used by an exhibition', async () => {
      prisma.exhibitionTemplate.findUnique.mockResolvedValue(template({ _count: { exhibitions: 1 } }));
      await expect(
        service.update('template-1', ownerOrgId, {
          roomShape: { kind: 'rectangle', width: 20, depth: 20 },
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.exhibitionTemplate.update).not.toHaveBeenCalled();
    });

    it('still allows color/wallHeight changes once the template is used by an exhibition', async () => {
      prisma.exhibitionTemplate.findUnique.mockResolvedValue(template({ _count: { exhibitions: 1 } }));
      await service.update('template-1', ownerOrgId, { wallHeight: 8, wallColor: '#123456' });
      const data = prisma.exhibitionTemplate.update.mock.calls[0][0].data;
      expect(data.wallHeight).toBe(8);
      expect(data.wallColor).toBe('#123456');
    });

    it('allows a room shape change when the template is unused', async () => {
      prisma.exhibitionTemplate.findUnique.mockResolvedValue(template({ _count: { exhibitions: 0 } }));
      const roomShape = { kind: 'rectangle' as const, width: 20, depth: 20 };
      await service.update('template-1', ownerOrgId, { roomShape });
      const data = prisma.exhibitionTemplate.update.mock.calls[0][0].data;
      expect(data.roomShape).toEqual(roomShape);
    });
  });
});
