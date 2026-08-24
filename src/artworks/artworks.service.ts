import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtworkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { slugify } from '../common/slugify';
import { CreateArtworkDto } from './dto/create-artwork.dto';
import { UpdateArtworkDto } from './dto/update-artwork.dto';
import { OWNER_SETTABLE_STATUSES } from './dto/set-artwork-status.dto';

const PUBLIC_STATUSES: ArtworkStatus[] = ['LISTED', 'IN_EXHIBITION'];
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class ArtworksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artistProfiles: ArtistProfilesService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(userId: string, dto: CreateArtworkDto) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    return this.prisma.artwork.create({
      data: { ...dto, artistProfileId: profile.id },
    });
  }

  // Folder-per-artist in Cloudinary, keyed off the artist's own User.name
  // (not the editable-elsewhere ArtistProfile.displayName) since artists
  // can't rename themselves post-signup, so the folder stays stable across
  // every upload without needing a persisted slug column.
  async uploadImage(userId: string, file: Express.Multer.File) {
    const [profile, user] = await Promise.all([
      this.artistProfiles.getOwnOrThrow(userId),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);
    const slug = slugify(user.name ?? profile.displayName);
    const url = await this.cloudinary.uploadImage(file, `artworks/${slug}`);
    return { url };
  }

  findPublic(take = DEFAULT_PAGE_SIZE, skip = 0) {
    return this.prisma.artwork.findMany({
      where: { status: { in: PUBLIC_STATUSES } },
      take: Math.min(take, MAX_PAGE_SIZE),
      skip,
      orderBy: { createdAt: 'desc' },
      // A curator browsing this list to place artworks into an exhibition
      // needs to see whose artwork it is (cross-artist curation).
      include: { artistProfile: true },
    });
  }

  // The curator's actual placement picker (ExhibitionArtworkPlacement.tsx)
  // uses this, not findPublic — artists now belong to an Organization
  // (invited by a curator, see OrganizationsService.addArtist), so a
  // curator should only be offered their own org's roster, not every
  // artist on the platform. findPublic stays fully open for a possible
  // future general "browse all art" page.
  findByOrganization(
    organizationId: string,
    take = DEFAULT_PAGE_SIZE,
    skip = 0,
  ) {
    return this.prisma.artwork.findMany({
      where: {
        status: { in: PUBLIC_STATUSES },
        artistProfile: { user: { organizationId } },
      },
      take: Math.min(take, MAX_PAGE_SIZE),
      skip,
      orderBy: { createdAt: 'desc' },
      include: { artistProfile: true },
    });
  }

  async findOwn(userId: string) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    return this.prisma.artwork.findMany({
      where: { artistProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      // Lets the artist see which exhibition(s) an artwork is currently placed in.
      include: { exhibitionLinks: { include: { exhibition: true } } },
    });
  }

  // Per-artwork view counts for the artist's own portfolio, plus (when an
  // artwork is currently placed) that exhibition's all-time visitor total —
  // the artist-scoped counterpart to ExhibitionsService.getStatsForOwner,
  // which gives the admin every artwork in the exhibition. An artist only
  // ever sees their own artwork's numbers, never another artist's, even
  // for a show they happen to share (same "don't see things unrelated to
  // you" boundary as the offers feature).
  async getStatsForArtist(userId: string) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    const artworks = await this.prisma.artwork.findMany({
      where: { artistProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { exhibitionLinks: { include: { exhibition: true } } },
    });

    const artworkIds = artworks.map((a) => a.id);
    const viewCounts = await this.prisma.visitEvent.groupBy({
      by: ['artworkId'],
      where: { artworkId: { in: artworkIds }, eventType: 'ARTWORK_VIEW' },
      _count: { artworkId: true },
    });
    const viewCountByArtworkId = new Map(
      viewCounts.map((v) => [v.artworkId, v._count.artworkId]),
    );

    const exhibitionIds = [
      ...new Set(
        artworks.flatMap((a) => a.exhibitionLinks.map((l) => l.exhibitionId)),
      ),
    ];
    const visitorCounts = await this.prisma.visitEvent.groupBy({
      by: ['exhibitionId'],
      where: {
        exhibitionId: { in: exhibitionIds },
        eventType: 'EXHIBITION_ENTER',
      },
      _count: { exhibitionId: true },
    });
    const visitorCountByExhibitionId = new Map(
      visitorCounts.map((v) => [v.exhibitionId, v._count.exhibitionId]),
    );

    return artworks.map((artwork) => {
      const link = artwork.exhibitionLinks[0];
      return {
        artworkId: artwork.id,
        title: artwork.title,
        viewCount: viewCountByArtworkId.get(artwork.id) ?? 0,
        exhibition: link
          ? {
              id: link.exhibition.id,
              title: link.exhibition.title,
              totalVisitors:
                visitorCountByExhibitionId.get(link.exhibitionId) ?? 0,
            }
          : null,
      };
    });
  }

  async findOneForView(id: string) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id },
      include: { artistProfile: true },
    });
    if (!artwork || !PUBLIC_STATUSES.includes(artwork.status)) {
      // Same 404 whether it doesn't exist or is just unpublished (draft/archived) —
      // don't leak which case it is to an unauthenticated caller.
      throw new NotFoundException('Artwork not found');
    }
    return artwork;
  }

  async update(id: string, userId: string, dto: UpdateArtworkDto) {
    await this.assertOwnership(id, userId);
    return this.prisma.artwork.update({ where: { id }, data: dto });
  }

  async setStatus(
    id: string,
    userId: string,
    status: (typeof OWNER_SETTABLE_STATUSES)[number],
  ) {
    const artwork = await this.assertOwnership(id, userId);
    if (!OWNER_SETTABLE_STATUSES.includes(artwork.status as never)) {
      throw new ConflictException(
        `Cannot change status from ${artwork.status} directly; it is managed by another flow`,
      );
    }
    return this.prisma.artwork.update({ where: { id }, data: { status } });
  }

  async archive(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.artwork.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  private async assertOwnership(id: string, userId: string) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id },
      include: { artistProfile: true },
    });
    if (!artwork) throw new NotFoundException('Artwork not found');
    if (artwork.artistProfile.userId !== userId) {
      throw new ForbiddenException('You do not own this artwork');
    }
    return artwork;
  }
}
