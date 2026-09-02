import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExhibitionsService } from './exhibitions.service';
import { PrismaService } from '../prisma/prisma.service';

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('ExhibitionsService', () => {
  const ownerUserId = 'user-owner';
  const ownerOrgId = 'org-owner';
  // A different ADMIN in a *different* organization — the org-scoped
  // equivalent of the old "other user" cross-ownership rejection tests.
  const otherOrgId = 'org-other';

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
      findFirst: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
      delete: jest.Mock<Promise<unknown>, [unknown]>;
      deleteMany: jest.Mock<Promise<unknown>, [unknown]>;
      count: jest.Mock<Promise<number>, [unknown]>;
    };
    artwork: {
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      updateMany: jest.Mock<Promise<unknown>, [unknown]>;
    };
    visitEvent: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      count: jest.Mock<Promise<number>, [unknown]>;
    };
    $transaction: jest.Mock;
  };
  let service: ExhibitionsService;

  const exhibitionWithStatus = (
    status: string,
    maxArtworks: number | null = null,
  ) => ({
    id: 'exhibition-1',
    status,
    curatorUserId: ownerUserId,
    organizationId: ownerOrgId,
    maxArtworks,
    deletedAt: null,
    artworkLinks: [],
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
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        delete: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        deleteMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({}),
        count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
      },
      artwork: {
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({}),
      },
      visitEvent: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
      },
      // Support both array-of-promises and interactive-callback $transaction forms.
      $transaction: jest.fn((arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        if (typeof arg === 'function')
          return (arg as (tx: unknown) => unknown)(prisma);
        return Promise.resolve(arg);
      }),
    };
    service = new ExhibitionsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('attaches the caller as curatorUserId and their organizationId', async () => {
      await service.create(ownerUserId, ownerOrgId, {
        title: 'Debut',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-15T00:00:00.000Z',
      });

      const [args] = prisma.exhibition.create.mock.calls[0] as [
        { data: { curatorUserId: string; organizationId: string } },
      ];
      expect(args.data.curatorUserId).toBe(ownerUserId);
      expect(args.data.organizationId).toBe(ownerOrgId);
    });

    it('rejects endDate <= startDate', async () => {
      await expect(
        service.create(ownerUserId, ownerOrgId, {
          title: 'Debut',
          startDate: '2026-01-15T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an admin with no organization', async () => {
      await expect(
        service.create(ownerUserId, null, {
          title: 'Debut',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-15T00:00:00.000Z',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setStatus (state machine)', () => {
    it('allows DRAFT -> ACTIVE and syncs LISTED artworks to IN_EXHIBITION', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );

      await service.setStatus('exhibition-1', ownerOrgId, 'ACTIVE');

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

      await service.setStatus('exhibition-1', ownerOrgId, 'ENDED');

      expect(prisma.artwork.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'IN_EXHIBITION',
          exhibitionLinks: { some: { exhibitionId: 'exhibition-1' } },
        },
        data: { status: 'LISTED' },
      });
    });

    it('allows ACTIVE -> DRAFT ("Yayından Kaldır") and reverts IN_EXHIBITION artworks to LISTED', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );

      await service.setStatus('exhibition-1', ownerOrgId, 'DRAFT');

      expect(prisma.artwork.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'IN_EXHIBITION',
          exhibitionLinks: { some: { exhibitionId: 'exhibition-1' } },
        },
        data: { status: 'LISTED' },
      });
      expect(prisma.exhibition.update).toHaveBeenCalledWith({
        where: { id: 'exhibition-1' },
        data: { status: 'DRAFT' },
      });
    });

    it('rejects DRAFT -> ENDED (must go through ACTIVE)', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await expect(
        service.setStatus('exhibition-1', ownerOrgId, 'ENDED'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects any transition out of ENDED (terminal state)', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ENDED'),
      );
      await expect(
        service.setStatus('exhibition-1', ownerOrgId, 'ACTIVE'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a non-owner', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await expect(
        service.setStatus('exhibition-1', otherOrgId, 'ACTIVE'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('soft-deletes a DRAFT exhibition (sets deletedAt, no row delete)', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await service.remove('exhibition-1', ownerOrgId);
      expect(prisma.exhibition.update).toHaveBeenCalledWith({
        where: { id: 'exhibition-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.exhibition.delete).not.toHaveBeenCalled();
    });

    it('also soft-deletes an ACTIVE exhibition and releases its IN_EXHIBITION artworks back to LISTED', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );
      await service.remove('exhibition-1', ownerOrgId);
      expect(prisma.artwork.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'IN_EXHIBITION',
          exhibitionLinks: { some: { exhibitionId: 'exhibition-1' } },
        },
        data: { status: 'LISTED' },
      });
      expect(prisma.exhibition.update).toHaveBeenCalledWith({
        where: { id: 'exhibition-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('refuses to remove an already-removed exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce({
        ...exhibitionWithStatus('DRAFT'),
        deletedAt: new Date(),
      });
      await expect(service.remove('exhibition-1', ownerOrgId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('restore', () => {
    it('clears deletedAt on a removed exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce({
        ...exhibitionWithStatus('DRAFT'),
        deletedAt: new Date(),
      });
      await service.restore('exhibition-1', ownerOrgId);
      expect(prisma.exhibition.update).toHaveBeenCalledWith({
        where: { id: 'exhibition-1' },
        data: { deletedAt: null },
      });
    });

    it('refuses to restore an exhibition that is not removed', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      await expect(service.restore('exhibition-1', ownerOrgId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('addArtwork', () => {
    it('allows the curator to place an artwork owned by a different artist (cross-artist curation)', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
        artistProfileId: 'profile-of-a-different-artist',
      });
      prisma.exhibitionArtwork.findFirst.mockResolvedValueOnce(null);

      await service.addArtwork('exhibition-1', ownerOrgId, {
        artworkId: 'artwork-1',
      });

      expect(prisma.exhibitionArtwork.create).toHaveBeenCalled();
    });

    it('rejects placing an ARCHIVED artwork', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'ARCHIVED',
      });

      await expect(
        service.addArtwork('exhibition-1', ownerOrgId, {
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
      });
      prisma.exhibitionArtwork.findFirst.mockResolvedValueOnce({
        exhibitionId: 'exhibition-1',
      });

      await expect(
        service.addArtwork('exhibition-1', ownerOrgId, {
          artworkId: 'artwork-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an artwork already placed in a different (e.g. another DRAFT) exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
      });
      prisma.exhibitionArtwork.findFirst.mockResolvedValueOnce({
        exhibitionId: 'some-other-exhibition',
      });

      await expect(
        service.addArtwork('exhibition-1', ownerOrgId, {
          artworkId: 'artwork-1',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.exhibitionArtwork.create).not.toHaveBeenCalled();
    });

    it('places a valid, LISTED artwork', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
      });
      prisma.exhibitionArtwork.findFirst.mockResolvedValueOnce(null);

      await service.addArtwork('exhibition-1', ownerOrgId, {
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

    it('rejects placement once maxArtworks is already reached', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT', 2),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
      });
      prisma.exhibitionArtwork.count.mockResolvedValueOnce(2);

      await expect(
        service.addArtwork('exhibition-1', ownerOrgId, {
          artworkId: 'artwork-1',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.exhibitionArtwork.create).not.toHaveBeenCalled();
    });

    it('allows placement under an unreached maxArtworks cap', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT', 2),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
      });
      prisma.exhibitionArtwork.count.mockResolvedValueOnce(1);
      prisma.exhibitionArtwork.findFirst.mockResolvedValueOnce(null);

      await service.addArtwork('exhibition-1', ownerOrgId, {
        artworkId: 'artwork-1',
      });

      expect(prisma.exhibitionArtwork.create).toHaveBeenCalled();
    });

    it('does not count-check when maxArtworks is unset (unlimited)', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('DRAFT'),
      );
      prisma.artwork.findUnique.mockResolvedValueOnce({
        id: 'artwork-1',
        status: 'LISTED',
      });
      prisma.exhibitionArtwork.findFirst.mockResolvedValueOnce(null);

      await service.addArtwork('exhibition-1', ownerOrgId, {
        artworkId: 'artwork-1',
      });

      expect(prisma.exhibitionArtwork.count).not.toHaveBeenCalled();
      expect(prisma.exhibitionArtwork.create).toHaveBeenCalled();
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

      await service.removeArtwork('exhibition-1', 'artwork-1', ownerOrgId);

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

      await service.removeArtwork('exhibition-1', 'artwork-1', ownerOrgId);

      expect(prisma.artwork.updateMany).not.toHaveBeenCalled();
    });

    it('404s when the artwork is not actually placed in the exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.removeArtwork('exhibition-1', 'artwork-1', ownerOrgId),
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

    it('maps each placed artwork to hasApprovedOffer, stripping the raw offers array', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce({
        ...exhibitionWithStatus('ACTIVE'),
        artworkLinks: [
          {
            id: 'link-1',
            artworkId: 'artwork-1',
            artwork: {
              id: 'artwork-1',
              title: 'Sold Piece',
              offers: [{ id: 'offer-1' }],
            },
          },
          {
            id: 'link-2',
            artworkId: 'artwork-2',
            artwork: { id: 'artwork-2', title: 'Unsold Piece', offers: [] },
          },
        ],
      });

      const result = await service.findOneForView('exhibition-1');

      expect(result.artworkLinks[0].artwork.hasApprovedOffer).toBe(true);
      expect(result.artworkLinks[0].artwork).not.toHaveProperty('offers');
      expect(result.artworkLinks[1].artwork.hasApprovedOffer).toBe(false);
    });
  });

  describe('findOneOwn', () => {
    it('returns a DRAFT exhibition for its owner (findOneForView would 404 this)', async () => {
      prisma.exhibition.findUnique
        .mockResolvedValueOnce(exhibitionWithStatus('DRAFT')) // assertOwnership
        .mockResolvedValueOnce({
          ...exhibitionWithStatus('DRAFT'),
          artworkLinks: [],
        });

      await expect(
        service.findOneOwn('exhibition-1', ownerOrgId),
      ).resolves.toEqual({
        ...exhibitionWithStatus('DRAFT'),
        artworkLinks: [],
      });
    });

    it('rejects a non-owner even for an ACTIVE exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(
        exhibitionWithStatus('ACTIVE'),
      );
      await expect(
        service.findOneOwn('exhibition-1', otherOrgId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('404s a nonexistent exhibition', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.findOneOwn('exhibition-1', ownerOrgId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordArtworkView', () => {
    beforeEach(() => {
      prisma.exhibition.findUnique.mockResolvedValue(
        exhibitionWithStatus('ACTIVE'),
      );
      prisma.artwork.findUnique.mockResolvedValue({ id: 'artwork-1' });
    });

    it('creates a VisitEvent and returns the updated count on a first view', async () => {
      prisma.visitEvent.count.mockResolvedValueOnce(1);

      await expect(
        service.recordArtworkView('exhibition-1', 'artwork-1', 'session-1'),
      ).resolves.toEqual({ count: 1 });

      expect(prisma.visitEvent.create).toHaveBeenCalledWith({
        data: {
          exhibitionId: 'exhibition-1',
          artworkId: 'artwork-1',
          sessionId: 'session-1',
          eventType: 'ARTWORK_VIEW',
        },
      });
    });

    it('does not increment when the same session views the same artwork again (dedup via unique constraint)', async () => {
      prisma.visitEvent.create.mockRejectedValueOnce(uniqueViolation());
      prisma.visitEvent.count.mockResolvedValueOnce(1);

      await expect(
        service.recordArtworkView('exhibition-1', 'artwork-1', 'session-1'),
      ).resolves.toEqual({ count: 1 });
    });

    it('rethrows non-duplicate errors instead of swallowing them', async () => {
      prisma.visitEvent.create.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.recordArtworkView('exhibition-1', 'artwork-1', 'session-1'),
      ).rejects.toThrow('db down');
    });

    it('404s when the exhibition does not exist', async () => {
      prisma.exhibition.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.recordArtworkView('exhibition-1', 'artwork-1', 'session-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s when the artwork does not exist', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.recordArtworkView('exhibition-1', 'artwork-1', 'session-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
