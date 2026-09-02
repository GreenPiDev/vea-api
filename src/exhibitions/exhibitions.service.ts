import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExhibitionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExhibitionDto } from './dto/create-exhibition.dto';
import { UpdateExhibitionDto } from './dto/update-exhibition.dto';
import { AddArtworkToExhibitionDto } from './dto/add-artwork-to-exhibition.dto';
import { UpdateExhibitionArtworkDto } from './dto/update-exhibition-artwork.dto';

const PUBLIC_STATUSES: ExhibitionStatus[] = ['ACTIVE', 'ENDED'];
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// DRAFT <-> ACTIVE -> ENDED. ENDED stays terminal (a published-then-ended
// show is a historical record, same reasoning as the old delete restriction
// this replaced — see remove()). ACTIVE -> DRAFT ("Yayından Kaldır") is the
// one backward move, added so a curator can unpublish without losing the
// exhibition (2026-09-02).
const ALLOWED_TRANSITIONS: Record<ExhibitionStatus, ExhibitionStatus[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['ENDED', 'DRAFT'],
  ENDED: [],
};

@Injectable()
export class ExhibitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    organizationId: string | null,
    dto: CreateExhibitionDto,
  ) {
    // Defensive only — in practice an ADMIN always has an organizationId,
    // since the only way to become ADMIN is via OrganizationsService.addAdmin,
    // which sets both fields together.
    if (!organizationId) {
      throw new ForbiddenException(
        'This admin is not assigned to an organization',
      );
    }
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }
    if (dto.artistProfileId) {
      await this.assertArtistInOrganization(dto.artistProfileId, organizationId);
    }
    return this.prisma.exhibition.create({
      data: {
        curatorUserId: userId,
        organizationId,
        artistProfileId: dto.artistProfileId,
        title: dto.title,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        maxArtworks: dto.maxArtworks,
        sceneConfig: dto.sceneConfig as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // Same cross-organization guard as ArtworksService.findByOrganization —
  // a curator may only pin an exhibition to an artist in their own org.
  private async assertArtistInOrganization(
    artistProfileId: string,
    organizationId: string,
  ): Promise<void> {
    const profile = await this.prisma.artistProfile.findUnique({
      where: { id: artistProfileId },
      select: { user: { select: { organizationId: true } } },
    });
    if (!profile || profile.user.organizationId !== organizationId) {
      throw new BadRequestException(
        'artistProfileId must belong to your own organization',
      );
    }
  }

  findPublic(take = DEFAULT_PAGE_SIZE, skip = 0) {
    return this.prisma.exhibition.findMany({
      where: { status: { in: PUBLIC_STATUSES }, deletedAt: null },
      take: Math.min(take, MAX_PAGE_SIZE),
      skip,
      orderBy: { startDate: 'desc' },
    });
  }

  // Every ADMIN in the same Organization shares this list — it's keyed by
  // organizationId, not the individual curatorUserId, so two admin-curators
  // at the same firm see and can manage each other's exhibitions. An ADMIN
  // with no organizationId (shouldn't happen in practice) sees an empty
  // list rather than every org's exhibitions or every organizationId:null
  // orphan row. `includeRemoved` backs the curator table's "Kaldırılan
  // sergileri göster" toggle — default false so soft-deleted rows stay
  // hidden until explicitly asked for (see ExhibitionStatsList.tsx, which
  // always passes true so a removal never drops exhibitions from stats).
  async findOwn(organizationId: string | null, includeRemoved = false) {
    if (!organizationId) return [];
    return this.prisma.exhibition.findMany({
      where: { organizationId, ...(includeRemoved ? {} : { deletedAt: null }) },
      orderBy: { createdAt: 'desc' },
      include: { artistProfile: { select: { id: true, displayName: true } } },
    });
  }

  /**
   * Owner-only full detail (any status, including DRAFT — findOneForView
   * rejects DRAFT even for the owner, since it's the public-facing read
   * path). Needed so an artist can place artworks on a wall before ever
   * publishing, instead of the exhibition having to go live empty first.
   */
  async findOneOwn(id: string, organizationId: string | null) {
    await this.assertOwnership(id, organizationId);
    return this.prisma.exhibition.findUnique({
      where: { id },
      include: {
        artworkLinks: {
          include: { artwork: { include: { artistProfile: true } } },
        },
      },
    });
  }

  async findOneForView(id: string) {
    const exhibition = await this.prisma.exhibition.findUnique({
      where: { id },
      // artistProfile is included so the 3D scene can render a wall label
      // (artist display name) without a second round-trip per artwork.
      // offers is included (existence only, never buyer/amount) so the
      // artwork detail card can show "sold" and hide the offer form once
      // the artist has recorded an informal artistDecision — see
      // ArtworksService.findOneForView's identical comment.
      include: {
        artworkLinks: {
          include: {
            artwork: {
              include: {
                artistProfile: true,
                offers: {
                  where: { artistDecision: 'APPROVED' },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    if (!exhibition || !PUBLIC_STATUSES.includes(exhibition.status) || exhibition.deletedAt) {
      throw new NotFoundException('Exhibition not found');
    }
    return {
      ...exhibition,
      artworkLinks: exhibition.artworkLinks.map((link) => {
        const { offers, ...artwork } = link.artwork;
        return {
          ...link,
          artwork: { ...artwork, hasApprovedOffer: offers.length > 0 },
        };
      }),
    };
  }

  async update(
    id: string,
    organizationId: string | null,
    dto: UpdateExhibitionDto,
  ) {
    await this.assertOwnership(id, organizationId);
    if (
      dto.startDate &&
      dto.endDate &&
      new Date(dto.endDate) <= new Date(dto.startDate)
    ) {
      throw new BadRequestException('endDate must be after startDate');
    }
    return this.prisma.exhibition.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        maxArtworks: dto.maxArtworks,
        sceneConfig: dto.sceneConfig as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async setStatus(
    id: string,
    organizationId: string | null,
    status: ExhibitionStatus,
  ) {
    const exhibition = await this.assertOwnership(id, organizationId);
    if (!ALLOWED_TRANSITIONS[exhibition.status].includes(status)) {
      throw new ConflictException(
        `Cannot move exhibition from ${exhibition.status} to ${status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        // Artwork.status LISTED -> IN_EXHIBITION for everything placed in this show.
        await tx.artwork.updateMany({
          where: {
            status: 'LISTED',
            exhibitionLinks: { some: { exhibitionId: id } },
          },
          data: { status: 'IN_EXHIBITION' },
        });
      } else if (status === 'ENDED' || status === 'DRAFT') {
        // Reverse (both "ended" and "unpublished back to draft" leave this
        // show non-live): only artworks still IN_EXHIBITION go back to
        // LISTED (a SOLD artwork stays SOLD — the sale flow owns that
        // transition, not this one).
        await tx.artwork.updateMany({
          where: {
            status: 'IN_EXHIBITION',
            exhibitionLinks: { some: { exhibitionId: id } },
          },
          data: { status: 'LISTED' },
        });
      }
      return tx.exhibition.update({ where: { id }, data: { status } });
    });
  }

  // Soft delete (2026-09-02, replacing the old DRAFT-only hard delete): sets
  // deletedAt instead of removing the row, so a seller's VisitEvent/Offer/
  // stats history tied to this exhibition survives — GET /exhibitions/mine/
  // :id/stats never filters on deletedAt, by design. Any status can now be
  // removed, including ACTIVE/ENDED, since nothing is actually destroyed.
  async remove(id: string, organizationId: string | null) {
    const exhibition = await this.assertOwnership(id, organizationId);
    if (exhibition.deletedAt) {
      throw new ConflictException('Exhibition is already removed');
    }
    return this.prisma.$transaction(async (tx) => {
      // Pulling a live show out of public view shouldn't leave its artworks
      // stuck "in exhibition" with nowhere to be seen — same reverse sync
      // as ACTIVE -> ENDED/DRAFT in setStatus (SOLD is left untouched).
      await tx.artwork.updateMany({
        where: { status: 'IN_EXHIBITION', exhibitionLinks: { some: { exhibitionId: id } } },
        data: { status: 'LISTED' },
      });
      return tx.exhibition.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  async restore(id: string, organizationId: string | null) {
    const exhibition = await this.assertOwnership(id, organizationId);
    if (!exhibition.deletedAt) {
      throw new ConflictException('Exhibition is not removed');
    }
    return this.prisma.exhibition.update({ where: { id }, data: { deletedAt: null } });
  }

  async addArtwork(
    exhibitionId: string,
    organizationId: string | null,
    dto: AddArtworkToExhibitionDto,
  ) {
    const exhibition = await this.assertOwnership(exhibitionId, organizationId);
    // Curator role, not artist ownership — a curator places any artist's
    // artwork into the exhibitions they run (cross-artist curation).
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: dto.artworkId },
    });
    if (!artwork) throw new NotFoundException('Artwork not found');
    if (artwork.status === 'ARCHIVED' || artwork.status === 'SOLD') {
      throw new ConflictException(
        `Cannot place a ${artwork.status} artwork into an exhibition`,
      );
    }

    if (exhibition.maxArtworks != null) {
      const placedCount = await this.prisma.exhibitionArtwork.count({
        where: { exhibitionId },
      });
      if (placedCount >= exhibition.maxArtworks) {
        throw new ConflictException(
          `Exhibition already has the maximum of ${exhibition.maxArtworks} artworks placed`,
        );
      }
    }

    // Scoped to artworkId only, not exhibitionId+artworkId — an artwork may
    // be placed in at most one exhibition at a time, DRAFT ones included
    // (Artwork.status only flips LISTED->IN_EXHIBITION when its exhibition
    // goes ACTIVE, so without this check the same LISTED artwork could be
    // added to two different DRAFT exhibitions with nothing to catch it).
    const existing = await this.prisma.exhibitionArtwork.findFirst({
      where: { artworkId: dto.artworkId },
    });
    if (existing)
      throw new ConflictException(
        existing.exhibitionId === exhibitionId
          ? 'Artwork is already placed in this exhibition'
          : 'Artwork is already placed in another exhibition',
      );

    return this.prisma.exhibitionArtwork.create({
      data: {
        exhibitionId,
        artworkId: dto.artworkId,
        positionData: dto.positionData as unknown as Prisma.InputJsonValue,
        order: dto.order,
      },
    });
  }

  async updateArtworkLink(
    exhibitionId: string,
    artworkId: string,
    organizationId: string | null,
    dto: UpdateExhibitionArtworkDto,
  ) {
    await this.assertOwnership(exhibitionId, organizationId);
    await this.assertLinkExists(exhibitionId, artworkId);
    return this.prisma.exhibitionArtwork.update({
      where: { exhibitionId_artworkId: { exhibitionId, artworkId } },
      data: {
        positionData: dto.positionData as unknown as Prisma.InputJsonValue,
        order: dto.order,
      },
    });
  }

  async removeArtwork(
    exhibitionId: string,
    artworkId: string,
    organizationId: string | null,
  ) {
    const exhibition = await this.assertOwnership(exhibitionId, organizationId);
    await this.assertLinkExists(exhibitionId, artworkId);

    await this.prisma.$transaction(async (tx) => {
      await this.removeArtworkLink(tx, exhibition, artworkId);
    });
  }

  // Shared by removeArtwork() above and ArtworkRemovalRequestsService (which
  // composes this with ArtworksService.archiveForRemoval in one transaction
  // after a curator approves an artist's removal request) — same link
  // deletion + ACTIVE-only status sync, just callable with a caller-owned
  // transaction client instead of always opening its own.
  async removeArtworkLink(
    tx: Prisma.TransactionClient,
    exhibition: { id: string; status: ExhibitionStatus },
    artworkId: string,
  ) {
    await tx.exhibitionArtwork.delete({
      where: {
        exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId },
      },
    });
    if (exhibition.status === 'ACTIVE') {
      await tx.artwork.updateMany({
        where: { id: artworkId, status: 'IN_EXHIBITION' },
        data: { status: 'LISTED' },
      });
    }
  }

  // Lightweight analytics counter — only checks both ids actually exist, no
  // ownership/placement-link check. Public, no auth, same "browsing an
  // exhibition is free" philosophy as the rest of this module; a bit of
  // spammable inaccuracy here is an acceptable trade-off for a non-critical
  // view count (unlike Offer/payment paths, which are strict).
  //
  // Deduped per (artworkId, sessionId): one session viewing the same artwork
  // repeatedly (re-opening the card, a React double-effect in dev, a retried
  // request) counts once, like a "unique view". The DB-level unique
  // constraint on VisitEvent makes this race-safe even if two near-identical
  // requests land at once — the loser just hits P2002 and is swallowed.
  async recordArtworkView(
    exhibitionId: string,
    artworkId: string,
    sessionId: string,
  ) {
    const [exhibition, artwork] = await Promise.all([
      this.prisma.exhibition.findUnique({ where: { id: exhibitionId } }),
      this.prisma.artwork.findUnique({ where: { id: artworkId } }),
    ]);
    if (!exhibition) throw new NotFoundException('Exhibition not found');
    if (!artwork) throw new NotFoundException('Artwork not found');

    try {
      await this.prisma.visitEvent.create({
        data: { exhibitionId, artworkId, sessionId, eventType: 'ARTWORK_VIEW' },
      });
    } catch (err) {
      const isDuplicate =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002';
      if (!isDuplicate) throw err;
    }
    const count = await this.prisma.visitEvent.count({
      where: { artworkId, eventType: 'ARTWORK_VIEW' },
    });
    return { count };
  }

  // Cumulative (all-time) visitor count — distinct from the live/concurrent
  // count ExhibitionGateway broadcasts over WebSocket. Both are derived
  // from the same EXHIBITION_ENTER VisitEvent rows, just aggregated
  // differently (count of rows ever vs. current room size).
  async getStatsForOwner(id: string, organizationId: string | null) {
    await this.assertOwnership(id, organizationId);

    const [totalVisitors, links] = await Promise.all([
      this.prisma.visitEvent.count({
        where: { exhibitionId: id, eventType: 'EXHIBITION_ENTER' },
      }),
      this.prisma.exhibitionArtwork.findMany({
        where: { exhibitionId: id },
        include: { artwork: { select: { id: true, title: true } } },
      }),
    ]);

    const artworkIds = links.map((link) => link.artworkId);
    const viewCounts = await this.prisma.visitEvent.groupBy({
      by: ['artworkId'],
      where: { artworkId: { in: artworkIds }, eventType: 'ARTWORK_VIEW' },
      _count: { artworkId: true },
    });
    const viewCountByArtworkId = new Map(
      viewCounts.map((v) => [v.artworkId, v._count.artworkId]),
    );

    return {
      totalVisitors,
      artworks: links.map((link) => ({
        artworkId: link.artworkId,
        title: link.artwork.title,
        viewCount: viewCountByArtworkId.get(link.artworkId) ?? 0,
      })),
    };
  }

  private async assertOwnership(id: string, organizationId: string | null) {
    const exhibition = await this.prisma.exhibition.findUnique({
      where: { id },
    });
    if (!exhibition) throw new NotFoundException('Exhibition not found');
    // organizationId===null never matches, even against a legacy/orphan
    // exhibition row whose own organizationId also happens to be null — an
    // admin with no organization must never be treated as owning anything.
    if (!organizationId || exhibition.organizationId !== organizationId) {
      throw new ForbiddenException(
        'This exhibition does not belong to your organization',
      );
    }
    return exhibition;
  }

  private async assertLinkExists(exhibitionId: string, artworkId: string) {
    const link = await this.prisma.exhibitionArtwork.findUnique({
      where: { exhibitionId_artworkId: { exhibitionId, artworkId } },
    });
    if (!link)
      throw new NotFoundException('Artwork is not placed in this exhibition');
    return link;
  }
}
