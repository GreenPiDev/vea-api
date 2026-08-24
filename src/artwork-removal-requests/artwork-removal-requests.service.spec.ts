import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ArtworkRemovalRequestsService } from './artwork-removal-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ExhibitionsService } from '../exhibitions/exhibitions.service';
import { ArtworksService } from '../artworks/artworks.service';

describe('ArtworkRemovalRequestsService', () => {
  const artistUserId = 'user-artist';
  const otherUserId = 'user-other';
  const adminUserId = 'user-admin';
  const orgId = 'org-1';

  const artwork = {
    id: 'artwork-1',
    title: 'Test Artwork',
    artistProfile: { userId: artistUserId },
  };
  const exhibition = {
    id: 'exhibition-1',
    title: 'Test Show',
    organizationId: orgId,
    status: 'ACTIVE',
  };
  const link = {
    exhibitionId: 'exhibition-1',
    artworkId: 'artwork-1',
    exhibition,
  };

  const requestRow = (status = 'PENDING') => ({
    id: 'request-1',
    artworkId: 'artwork-1',
    exhibitionId: 'exhibition-1',
    requestedById: artistUserId,
    message: 'Please take it down',
    status,
    responseMessage: null,
    decidedById: null,
    artwork,
    exhibition,
  });

  let prisma: {
    artwork: { findUnique: jest.Mock<Promise<unknown>, [unknown]> };
    exhibitionArtwork: { findUnique: jest.Mock<Promise<unknown>, [unknown]> };
    artworkRemovalRequest: {
      findFirst: jest.Mock<Promise<unknown>, [unknown]>;
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      findUniqueOrThrow: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
    $transaction: jest.Mock;
  };
  let notifications: {
    create: jest.Mock<Promise<unknown>, [string, string, object]>;
    createForMany: jest.Mock<Promise<unknown>, [string[], string, object]>;
  };
  let organizations: {
    getOrgAdminUserIds: jest.Mock<Promise<string[]>, [string | null]>;
  };
  let exhibitions: {
    removeArtworkLink: jest.Mock<Promise<unknown>, [unknown, unknown, string]>;
  };
  let artworks: {
    archiveForRemoval: jest.Mock<Promise<unknown>, [string, unknown]>;
  };
  let service: ArtworkRemovalRequestsService;

  beforeEach(() => {
    prisma = {
      artwork: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
      exhibitionArtwork: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
      artworkRemovalRequest: {
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
        create: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(requestRow()),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        findUniqueOrThrow: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(requestRow('APPROVED')),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
      $transaction: jest.fn((arg: unknown) => {
        if (typeof arg === 'function')
          return (arg as (tx: unknown) => unknown)(prisma);
        return Promise.resolve(arg);
      }),
    };
    notifications = {
      create: jest
        .fn<Promise<unknown>, [string, string, object]>()
        .mockResolvedValue({}),
      createForMany: jest
        .fn<Promise<unknown>, [string[], string, object]>()
        .mockResolvedValue(undefined),
    };
    organizations = {
      getOrgAdminUserIds: jest
        .fn<Promise<string[]>, [string | null]>()
        .mockResolvedValue(['admin-1']),
    };
    exhibitions = {
      removeArtworkLink: jest
        .fn<Promise<unknown>, [unknown, unknown, string]>()
        .mockResolvedValue(undefined),
    };
    artworks = {
      archiveForRemoval: jest
        .fn<Promise<unknown>, [string, unknown]>()
        .mockResolvedValue({}),
    };
    service = new ArtworkRemovalRequestsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      organizations as unknown as OrganizationsService,
      exhibitions as unknown as ExhibitionsService,
      artworks as unknown as ArtworksService,
    );
  });

  describe('create', () => {
    const dto = {
      artworkId: 'artwork-1',
      exhibitionId: 'exhibition-1',
      message: 'Please take it down',
    };

    it('creates a request and notifies the exhibition org admins', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork);
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce(link);

      await service.create(artistUserId, dto);

      expect(prisma.artworkRemovalRequest.create).toHaveBeenCalledWith({
        data: {
          artworkId: 'artwork-1',
          exhibitionId: 'exhibition-1',
          requestedById: artistUserId,
          message: dto.message,
        },
      });
      expect(notifications.createForMany).toHaveBeenCalledWith(
        ['admin-1'],
        'ARTWORK_REMOVAL_REQUESTED',
        expect.objectContaining({ artworkId: 'artwork-1' }) as object,
      );
    });

    it('rejects a non-owner', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork);
      await expect(service.create(otherUserId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('404s when the artwork is not actually placed in the given exhibition', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork);
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce(null);
      await expect(service.create(artistUserId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a duplicate pending request for the same artwork+exhibition', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork);
      prisma.exhibitionArtwork.findUnique.mockResolvedValueOnce(link);
      prisma.artworkRemovalRequest.findFirst.mockResolvedValueOnce(
        requestRow(),
      );
      await expect(service.create(artistUserId, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('decide', () => {
    it('approving removes the exhibition link and archives the artwork', async () => {
      prisma.artworkRemovalRequest.findUnique.mockResolvedValueOnce(
        requestRow(),
      );

      await service.decide(
        'request-1',
        adminUserId,
        orgId,
        'APPROVED',
        'Tamam, kaldırıldı',
      );

      expect(exhibitions.removeArtworkLink).toHaveBeenCalledWith(
        prisma,
        exhibition,
        'artwork-1',
      );
      expect(artworks.archiveForRemoval).toHaveBeenCalledWith(
        'artwork-1',
        prisma,
      );
      expect(prisma.artworkRemovalRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: {
          status: 'APPROVED',
          responseMessage: 'Tamam, kaldırıldı',
          decidedById: adminUserId,
          respondedAt: expect.any(Date) as Date,
        },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        artistUserId,
        'ARTWORK_REMOVAL_DECIDED',
        expect.objectContaining({ decision: 'APPROVED' }) as object,
      );
    });

    it('rejecting leaves the exhibition link and artwork untouched', async () => {
      prisma.artworkRemovalRequest.findUnique.mockResolvedValueOnce(
        requestRow(),
      );

      await service.decide(
        'request-1',
        adminUserId,
        orgId,
        'REJECTED',
        'Sergi devam ediyor',
      );

      expect(exhibitions.removeArtworkLink).not.toHaveBeenCalled();
      expect(artworks.archiveForRemoval).not.toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalledWith(
        artistUserId,
        'ARTWORK_REMOVAL_DECIDED',
        expect.objectContaining({ decision: 'REJECTED' }) as object,
      );
    });

    it('rejects an admin from a different organization', async () => {
      prisma.artworkRemovalRequest.findUnique.mockResolvedValueOnce(
        requestRow(),
      );
      await expect(
        service.decide('request-1', adminUserId, 'org-2', 'APPROVED', 'x'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects deciding a request that is no longer pending', async () => {
      prisma.artworkRemovalRequest.findUnique.mockResolvedValueOnce(
        requestRow('APPROVED'),
      );
      await expect(
        service.decide('request-1', adminUserId, orgId, 'REJECTED', 'x'),
      ).rejects.toThrow(ConflictException);
    });

    it('404s a nonexistent request', async () => {
      prisma.artworkRemovalRequest.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.decide('missing', adminUserId, orgId, 'APPROVED', 'x'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
