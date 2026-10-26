import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FurnitureAssetsService } from './furniture-assets.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../common/r2/r2.service';
import { FileUrlService } from '../common/r2/file-url.service';

describe('FurnitureAssetsService', () => {
  const ownerOrgId = 'org-owner';
  const otherOrgId = 'org-other';

  let prisma: {
    furnitureAsset: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
      delete: jest.Mock<Promise<unknown>, [unknown]>;
    };
  };
  let service: FurnitureAssetsService;
  let r2: { deleteObject: jest.Mock<Promise<void>, [string]> };

  const asset = (overrides: Record<string, unknown> = {}) => ({
    id: 'asset-1',
    organizationId: ownerOrgId,
    name: 'Koltuk',
    modelUrl: 'https://example.com/files?key=VEA/development/furniture-models/model.glb',
    thumbnailUrl: null,
    nativeWidth: 1.8,
    nativeDepth: 0.8,
    scale: 1,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      furnitureAsset: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        delete: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
    };
    r2 = { deleteObject: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined) };
    const fileUrl = new FileUrlService({
      get: () => undefined,
    } as unknown as ConstructorParameters<typeof FileUrlService>[0]);
    service = new FurnitureAssetsService(
      prisma as unknown as PrismaService,
      r2 as unknown as R2Service,
      fileUrl,
    );
  });

  describe('create', () => {
    it('rejects an admin with no organizationId', () => {
      expect(() =>
        service.create(null, {
          name: 'x',
          modelUrl: 'https://example.com/model.glb',
          nativeWidth: 1,
          nativeDepth: 1,
        }),
      ).toThrow(ForbiddenException);
    });

    it('stores the given organizationId', async () => {
      await service.create(ownerOrgId, {
        name: 'Koltuk',
        modelUrl: 'https://example.com/model.glb',
        nativeWidth: 1.8,
        nativeDepth: 0.8,
      });
      const data = prisma.furnitureAsset.create.mock.calls[0][0].data;
      expect(data.organizationId).toBe(ownerOrgId);
      expect(data.name).toBe('Koltuk');
    });

    it('forwards isSeating', async () => {
      await service.create(ownerOrgId, {
        name: 'Koltuk',
        modelUrl: 'https://example.com/model.glb',
        nativeWidth: 1.8,
        nativeDepth: 0.8,
        isSeating: true,
      });
      const data = prisma.furnitureAsset.create.mock.calls[0][0].data;
      expect(data.isSeating).toBe(true);
    });
  });

  describe('findByOrganization', () => {
    it('unions platform defaults (organizationId null) with the given organization', async () => {
      await service.findByOrganization(ownerOrgId);
      const args = prisma.furnitureAsset.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        OR: [{ organizationId: null }, { organizationId: ownerOrgId }],
      });
    });

    it('returns only platform defaults when organizationId is null', async () => {
      await service.findByOrganization(null);
      const args = prisma.furnitureAsset.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ organizationId: null });
    });
  });

  describe('ownership', () => {
    it('rejects updating a platform default (organizationId null)', async () => {
      prisma.furnitureAsset.findUnique.mockResolvedValue(
        asset({ organizationId: null }),
      );
      await expect(
        service.update('asset-1', ownerOrgId, { name: 'y' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.furnitureAsset.update).not.toHaveBeenCalled();
    });

    it('rejects updating another organization\'s asset', async () => {
      prisma.furnitureAsset.findUnique.mockResolvedValue(asset());
      await expect(
        service.update('asset-1', otherOrgId, { name: 'y' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects removing a missing asset', async () => {
      prisma.furnitureAsset.findUnique.mockResolvedValue(null);
      await expect(
        service.remove('missing', ownerOrgId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows updating the organization\'s own asset', async () => {
      prisma.furnitureAsset.findUnique.mockResolvedValue(asset());
      await service.update('asset-1', ownerOrgId, {
        name: 'Yeni İsim',
        scale: 1.5,
        isSeating: true,
      });
      const data = prisma.furnitureAsset.update.mock.calls[0][0].data;
      expect(data.name).toBe('Yeni İsim');
      expect(data.scale).toBe(1.5);
      expect(data.isSeating).toBe(true);
    });

    it('allows removing the organization\'s own asset', async () => {
      prisma.furnitureAsset.findUnique.mockResolvedValue(asset());
      await service.remove('asset-1', ownerOrgId);
      expect(prisma.furnitureAsset.delete).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
      });
    });

    it('deletes the R2 objects behind modelUrl/thumbnailUrl on removal', async () => {
      prisma.furnitureAsset.findUnique.mockResolvedValue(
        asset({
          modelUrl: 'https://example.com/files?key=VEA/development/furniture-models/model.glb',
          thumbnailUrl: 'https://example.com/files?key=VEA/development/furniture-thumbnails/thumb.png',
        }),
      );
      await service.remove('asset-1', ownerOrgId);
      expect(r2.deleteObject).toHaveBeenCalledWith(
        'VEA/development/furniture-models/model.glb',
      );
      expect(r2.deleteObject).toHaveBeenCalledWith(
        'VEA/development/furniture-thumbnails/thumb.png',
      );
    });

    it('skips R2 deletion when thumbnailUrl is null', async () => {
      prisma.furnitureAsset.findUnique.mockResolvedValue(asset({ thumbnailUrl: null }));
      await service.remove('asset-1', ownerOrgId);
      expect(r2.deleteObject).toHaveBeenCalledTimes(1);
    });
  });
});
