import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ArtworksService } from './artworks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';

describe('ArtworksService', () => {
  const ownerUserId = 'user-owner';
  const otherUserId = 'user-other';
  const profile = { id: 'profile-1', userId: ownerUserId };

  let prisma: {
    artwork: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
  };
  let artistProfiles: {
    getOwnOrThrow: jest.Mock<Promise<typeof profile>, [string]>;
  };
  let service: ArtworksService;

  const artworkWithStatus = (status: string) => ({
    id: 'artwork-1',
    status,
    artistProfile: { userId: ownerUserId },
  });

  beforeEach(() => {
    prisma = {
      artwork: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
    };
    artistProfiles = {
      getOwnOrThrow: jest
        .fn<Promise<typeof profile>, [string]>()
        .mockResolvedValue(profile),
    };
    service = new ArtworksService(
      prisma as unknown as PrismaService,
      artistProfiles as unknown as ArtistProfilesService,
    );
  });

  describe('create', () => {
    it('attaches the caller-owned artistProfileId, not one from the DTO', async () => {
      await service.create(ownerUserId, { title: 'Untitled' } as never);

      expect(artistProfiles.getOwnOrThrow).toHaveBeenCalledWith(ownerUserId);
      const [args] = prisma.artwork.create.mock.calls[0] as [
        { data: { artistProfileId: string } },
      ];
      expect(args.data.artistProfileId).toBe(profile.id);
    });
  });

  describe('findOneForView', () => {
    it('returns a LISTED artwork', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('LISTED'),
      );
      await expect(service.findOneForView('artwork-1')).resolves.toBeDefined();
    });

    it('404s a DRAFT artwork even though it exists (no owner-bypass on the public route)', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('DRAFT'),
      );
      await expect(service.findOneForView('artwork-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404s a nonexistent artwork', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOneForView('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ownership enforcement (update/setStatus/archive)', () => {
    it('update rejects a non-owner with 403', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('DRAFT'),
      );
      await expect(
        service.update('artwork-1', otherUserId, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('update 404s when the artwork does not exist', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('missing', ownerUserId, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('setStatus allows the owner to move DRAFT -> LISTED', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('DRAFT'),
      );
      await service.setStatus('artwork-1', ownerUserId, 'LISTED');
      expect(prisma.artwork.update).toHaveBeenCalledWith({
        where: { id: 'artwork-1' },
        data: { status: 'LISTED' },
      });
    });

    it('setStatus refuses to move a SOLD artwork back to LISTED', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('SOLD'),
      );
      await expect(
        service.setStatus('artwork-1', ownerUserId, 'LISTED'),
      ).rejects.toThrow(ConflictException);
    });

    it('archive sets status to ARCHIVED regardless of current status', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('LISTED'),
      );
      await service.archive('artwork-1', ownerUserId);
      expect(prisma.artwork.update).toHaveBeenCalledWith({
        where: { id: 'artwork-1' },
        data: { status: 'ARCHIVED' },
      });
    });

    it('archive rejects a non-owner', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('LISTED'),
      );
      await expect(service.archive('artwork-1', otherUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
