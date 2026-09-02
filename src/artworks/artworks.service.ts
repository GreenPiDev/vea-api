import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtworkStatus, Prisma } from '@prisma/client';
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
      // exhibitionLinks lets the curator's placement picker
      // (ExhibitionArtworkPlacement.tsx) tell "never placed anywhere" apart
      // from "already placed in a different exhibition" — an artwork can
      // only ever be in one exhibition at a time (addArtwork's own
      // findFirst({where:{artworkId}}) check), so the picker shows the
      // latter grayed out with the other exhibition's title instead of
      // silently omitting it or letting the curator hit a 409.
      include: {
        artistProfile: true,
        exhibitionLinks: { include: { exhibition: { select: { id: true, title: true } } } },
      },
    });
  }

  async findOwn(userId: string) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    return this.prisma.artwork.findMany({
      where: { artistProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        // Lets the artist see which exhibition(s) an artwork is currently placed in.
        exhibitionLinks: { include: { exhibition: true } },
        // So ArtworkList.tsx can swap the delete button for a "request
        // pending" badge instead of letting the artist re-open a second
        // removal request for the same artwork.
        removalRequests: {
          where: { status: 'PENDING' },
          select: { id: true, status: true, exhibitionId: true },
        },
      },
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
      include: {
        artistProfile: true,
        // Only existence matters, never which offer/buyer — artistDecision
        // is the informal, artist-set "I've accepted this" signal (see
        // Offer.artistDecision's comment), separate from the real
        // Offer.status state machine. Surfacing it here as a plain boolean
        // lets the public artwork view show "sold" and lets OffersService
        // block further offers, without leaking any offer/buyer detail.
        offers: { where: { artistDecision: 'APPROVED' }, select: { id: true } },
      },
    });
    if (!artwork || !PUBLIC_STATUSES.includes(artwork.status)) {
      // Same 404 whether it doesn't exist or is just unpublished (draft/archived) —
      // don't leak which case it is to an unauthenticated caller.
      throw new NotFoundException('Artwork not found');
    }
    const { offers, ...rest } = artwork;
    return { ...rest, hasApprovedOffer: offers.length > 0 };
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
    const artwork = await this.assertOwnership(id, userId);
    const activeLink = await this.prisma.exhibitionArtwork.findFirst({
      where: { artworkId: id },
    });
    if (activeLink) {
      throw new ConflictException(
        'Bu eser bir sergide sergileniyor, doğrudan silinemez',
      );
    }
    return this.prisma.artwork.update({
      where: { id: artwork.id },
      data: { status: 'ARCHIVED' },
    });
  }

  // Reactivates an ARCHIVED artwork. Deliberately does NOT touch
  // ExhibitionArtwork in any way — an ARCHIVED artwork can never have a
  // live link (archive()/archiveForRemoval() both guarantee that: the
  // former refuses to run while a link exists, the latter only runs right
  // after the link was deleted in the same transaction), so there is
  // nothing to "not re-add" here, but the omission is intentional: the
  // artist has to place it in a show again themselves, unarchiving alone
  // never puts it back on a wall.
  async unarchive(id: string, userId: string) {
    const artwork = await this.assertOwnership(id, userId);
    if (artwork.status !== 'ARCHIVED') {
      throw new ConflictException('Bu eser arşivde değil');
    }
    return this.prisma.artwork.update({
      where: { id },
      data: { status: 'LISTED' },
    });
  }

  // Used only by ArtworkRemovalRequestsService after an admin approves an
  // artist's removal request — by that point the ExhibitionArtwork link has
  // already been deleted in the same transaction, and the caller is the
  // curator (not the artist), so the ownership/link guards in archive()
  // above don't apply here.
  archiveForRemoval(id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.artwork.update({
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
