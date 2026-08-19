import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExhibitionsService } from './exhibitions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';

describe('ExhibitionsService', () => {
  const ownerUserId = 'user-owner';
  const otherUserId = 'user-other';
  const profile = { id: 'profile-1', userId: ownerUserId };

  let prisma: {
    exhibition: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
      delete: jest.Mock<Promise<unknown>, [unknown]>;
    };
    exhibitionArtwork: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
      delete: jest.Mock<Promise<unknown>, [unknown]>;
      deleteMany: jest.Mock<Promise<unknown>, [unknown]>;
    };
    artwork: {
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      updateMany: jest.Mock<Promise<unknown>, [unknown]>;
    };
    $transaction: jest.Mock;
  };
  let artistProfiles: {
    getOwnOrThrow: jest.Mock<Promise<typeof profile>, [string]>;
  };
  let service: ExhibitionsService;

  const exhibitionWithStatus = (status: string) => ({
    id: 'exhibition-1',
    status,
    ownerProfile: { userId: ownerUserId },
  });

  beforeEach(() => {
    prisma = {
      exhibition: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        delete: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
      exhibitionArtwork: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        delete: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        deleteMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({}),
      },
      artwork: {
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({}),
      },
      // Support both array-of-promises and interactive-callback $transaction forms.
      $transaction: jest.fn((arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        if (typeof arg === 'function')
          return (arg as (tx: unknown) => unknown)(prisma);
        return Promise.resolve(arg);
      }),
    };
    artistProfiles = {
      getOwnOrThrow: jest
        .fn<Promise<typeof profile>, [string]>()
        .mockResolvedValue(profile),
    };
    service = new ExhibitionsService(
      prisma as unknown as PrismaService,
      artistProfiles as unknown as ArtistProfilesService,
    );
  });

  describe('create', () => {
    it('attaches the caller-owned ownerProfileId', async () => {
      await service.create(ownerUserId, {
        title: 'Debut',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-15T00:00:00.000Z',
      });

      const [args] = prisma.exhibition.create.mock.calls[0] as [
        { data: { ownerProfileId: string } },
      ];
      expect(args.data.ownerProfileId).toBe(profile.id);
    });

    it('rejects endDate <= startDate', async () => {
      await expect(
        service.create(ownerUserId, {
          title: 'Debut',
          startDate: '2026-01-15T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setStatus (state machine)', () => {
    it('allows DRAFT -> ACTIVE and syncs LISTED artworks to IN_EXHIBITION', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );

      await service.setStatus('exhibition-1', ownerUserId, 'ACTIVE');

      expect(prisma.artwork.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'LISTED',
          exhibitionLinks: { some: { exhibitionId: 'exhibition-1' } },
        },
        data: { status: 'IN_EXHIBITION' },
      });
      expect(prisma.exhibition.update).toHaveBeenCalledWith({
        where: { id: 'exhibition-1' },
        data: { status: 'ACTIVE' },
      });
    });

    it('allows ACTIVE -> ENDED and reverts IN_EXHIBITION artworks to LISTED', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );

      await service.setStatus('exhibition-1', ownerUserId, 'ENDED');

      expect(prisma.artwork.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'IN_EXHIBITION',
          exhibitionLinks: { some: { exhibitionId: 'exhibition-1' } },
        },
        data: { status: 'LISTED' },
      });
    });

    it('rejects DRAFT -> ENDED (must go through ACTIVE)', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await expect(
        service.setStatus('exhibition-1', ownerUserId, 'ENDED'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects any transition out of ENDED (terminal state)', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ENDED'),
      );
      await expect(
        service.setStatus('exhibition-1', ownerUserId, 'ACTIVE'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a non-owner', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await expect(
        service.setStatus('exhibition-1', otherUserId, 'ACTIVE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes a DRAFT exhibition and its artwork links', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await service.remove('exhibition-1', ownerUserId);
      expect(prisma.exhibitionArtwork.deleteMany).toHaveBeenCalledWith({
        where: { exhibitionId: 'exhibition-1' },
      });
      expect(prisma.exhibition.delete).toHaveBeenCalledWith({
        where: { id: 'exhibition-1' },
      });
    });

    it('refuses to delete an ACTIVE exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );
      await expect(service.remove('exhibition-1', ownerUserId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('addArtwork', () => {
    it('rejects placing an artwork owned by someone else', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
        artistProfile: { userId: otherUserId },
      });

      await expect(
        service.addArtwork('exhibition-1', ownerUserId, {
          artworkId: 'artwork-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects placing an ARCHIVED artwork', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'ARCHIVED',
        artistProfile: { userId: ownerUserId },
      });

      await expect(
        service.addArtwork('exhibition-1', ownerUserId, {
          artworkId: 'artwork-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a duplicate placement', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
        artistProfile: { userId: ownerUserId },
      });
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce({
        exhibitionId: 'exhibition-1',
      });

      await expect(
        service.addArtwork('exhibition-1', ownerUserId, {
          artworkId: 'artwork-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('places a valid, owned, LISTED artwork', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
        artistProfile: { userId: ownerUserId },
      });
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce(null);

      await service.addArtwork('exhibition-1', ownerUserId, {
        artworkId: 'artwork-1',
        order: 2,
      });

      expect(prisma.exhibitionArtwork.create).toHaveBeenCalledWith({
        data: {
          exhibitionId: 'exhibition-1',
          artworkId: 'artwork-1',
          positionData: undefined,
          order: 2,
        },
      });
    });
  });

  describe('removeArtwork', () => {
    it('reverts IN_EXHIBITION artwork to LISTED when removed from an ACTIVE exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce({
        exhibitionId: 'exhibition-1',
      });

      await service.removeArtwork('exhibition-1', 'artwork-1', ownerUserId);

      expect(prisma.artwork.updateMany).toHaveBeenCalledWith({
        where: { id: 'artwork-1', status: 'IN_EXHIBITION' },
        data: { status: 'LISTED' },
      });
    });

    it('does not touch artwork status when the exhibition is still DRAFT', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce({
        exhibitionId: 'exhibition-1',
      });

      await service.removeArtwork('exhibition-1', 'artwork-1', ownerUserId);

      expect(prisma.artwork.updateMany).not.toHaveBeenCalled();
    });

    it('404s when the artwork is not actually placed in the exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.removeArtwork('exhibition-1', 'artwork-1', ownerUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneForView', () => {
    it('404s a DRAFT exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await expect(service.findOneForView('exhibition-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns an ACTIVE exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );
      await expect(
        service.findOneForView('exhibition-1'),
      ).resolves.toBeDefined();
    });
  });
});
