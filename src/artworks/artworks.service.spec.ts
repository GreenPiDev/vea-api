import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ArtworksService } from './artworks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

describe('ArtworksService', () => {
  const ownerUserId = 'user-owner';
  const otherUserId = 'user-other';
  const profile = {
    id: 'profile-1',
    userId: ownerUserId,
    displayName: 'Owner Artist',
  };

  let prisma: {
    artwork: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
    exhibitionArtwork: {
      findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    };
    user: {
      findUniqueOrThrow: jest.Mock<Promise<unknown>, [unknown]>;
    };
  };
  let artistProfiles: {
    getOwnOrThrow: jest.Mock<Promise<typeof profile>, [string]>;
  };
  let cloudinary: {
    uploadImage: jest.Mock<
      Promise<string>,
      [unknown, string, ('image' | 'auto')?]
    >;
  };
  let service: ArtworksService;

  const artworkWithStatus = (status: string) => ({
    id: 'artwork-1',
    status,
    offers: [],
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
      exhibitionArtwork: {
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
      },
      user: {
        findUniqueOrThrow: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({ id: ownerUserId, name: 'Mustafa Akagündüz' }),
      },
    };
    artistProfiles = {
      getOwnOrThrow: jest
        .fn<Promise<typeof profile>, [string]>()
        .mockResolvedValue(profile),
    };
    cloudinary = {
      uploadImage: jest
        .fn<Promise<string>, [unknown, string, ('image' | 'auto')?]>()
        .mockResolvedValue(
          'https://res.cloudinary.com/test/image/upload/v1/VEA/development/artworks/mustafa-akagunduz/abc.jpg',
        ),
    };
    service = new ArtworksService(
      prisma as unknown as PrismaService,
      artistProfiles as unknown as ArtistProfilesService,
      cloudinary as unknown as CloudinaryService,
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

    it('reports hasApprovedOffer: false when no offer has an artist-approved decision', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('LISTED'),
      );
      const result = await service.findOneForView('artwork-1');
      expect(result.hasApprovedOffer).toBe(false);
      expect(result).not.toHaveProperty('offers');
    });

    it('reports hasApprovedOffer: true once an offer has an artist-approved decision', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce({
        ...artworkWithStatus('LISTED'),
        offers: [{ id: 'offer-1' }],
      });
      const result = await service.findOneForView('artwork-1');
      expect(result.hasApprovedOffer).toBe(true);
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

    it('archive rejects an artwork that is placed in an exhibition', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('IN_EXHIBITION'),
      );
      prisma.exhibitionArtwork.findFirst.mockResolvedValueOnce({
        id: 'link-1',
        exhibitionId: 'exhibition-1',
        artworkId: 'artwork-1',
      });
      await expect(service.archive('artwork-1', ownerUserId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.artwork.update).not.toHaveBeenCalled();
    });

    it('unarchive moves an ARCHIVED artwork back to LISTED', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('ARCHIVED'),
      );
      await service.unarchive('artwork-1', ownerUserId);
      expect(prisma.artwork.update).toHaveBeenCalledWith({
        where: { id: 'artwork-1' },
        data: { status: 'LISTED' },
      });
    });

    it('unarchive rejects an artwork that is not ARCHIVED', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('LISTED'),
      );
      await expect(service.unarchive('artwork-1', ownerUserId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('unarchive rejects a non-owner', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artworkWithStatus('ARCHIVED'),
      );
      await expect(service.unarchive('artwork-1', otherUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('uploadImage', () => {
    const file = {
      mimetype: 'image/png',
      buffer: Buffer.from('x'),
    } as Express.Multer.File;

    it('slugifies the caller-owned User.name (Turkish chars) into the Cloudinary folder', async () => {
      await service.uploadImage(ownerUserId, file);

      expect(cloudinary.uploadImage).toHaveBeenCalledWith(
        file,
        'artworks/mustafa-akagunduz',
      );
    });

    it('falls back to the artist profile displayName when User.name is unset', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
        id: ownerUserId,
        name: null,
      });

      await service.uploadImage(ownerUserId, file);

      expect(cloudinary.uploadImage).toHaveBeenCalledWith(
        file,
        'artworks/owner-artist',
      );
    });

    it('returns the secure_url from Cloudinary', async () => {
      await expect(service.uploadImage(ownerUserId, file)).resolves.toEqual({
        url: 'https://res.cloudinary.com/test/image/upload/v1/VEA/development/artworks/mustafa-akagunduz/abc.jpg',
      });
    });

    it('rejects a user with no artist profile yet', async () => {
      artistProfiles.getOwnOrThrow.mockRejectedValueOnce(
        new NotFoundException('No artist profile for this user yet'),
      );

      await expect(service.uploadImage(otherUserId, file)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
