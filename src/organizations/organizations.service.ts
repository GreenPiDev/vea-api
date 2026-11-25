import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  OrgArtistsQueryDto,
  OrgExhibitionsQueryDto,
  OrgOffersQueryDto,
} from './dto/org-overview-query.dto';
import { containsSearch, paginate } from '../common/pagination/paginate';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  create(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: { name: dto.name } });
  }

  // SUPERADMIN's organizations table needs more than the bare name to be
  // useful — admin/exhibition counts via a single Prisma _count query
  // (no N+1, filtered by role since the `admins` relation is really "every
  // user in this org", ADMIN and ARTIST alike — see the model comment).
  findAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            admins: { where: { role: UserRole.GALLERY_ADMIN } },
            exhibitions: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.assertExists(id);
    return this.prisma.organization.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  private async assertExists(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async listAdmins(organizationId: string) {
    await this.assertExists(organizationId);
    return this.prisma.user.findMany({
      where: { organizationId, role: UserRole.GALLERY_ADMIN },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAdmin(organizationId: string, email: string) {
    await this.assertExists(organizationId);
    return this.users.setAdminForOrganization(email, organizationId);
  }

  async removeAdmin(organizationId: string, userId: string) {
    await this.assertExists(organizationId);
    return this.users.removeFromOrganization(userId, organizationId);
  }

  // Curator-facing roster management — an ADMIN invites/removes artists
  // for their own org (organizationId comes from the caller's JWT, see
  // OrganizationsController's "mine/artists" routes), unlike the admins
  // sub-resource above which is SUPERADMIN-only with an explicit :id.
  async listArtists(organizationId: string) {
    await this.assertExists(organizationId);
    return this.prisma.user.findMany({
      where: { organizationId, role: UserRole.SELLER },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        // Lets the curator's exhibition-creation dropdown (ExhibitionForm.tsx)
        // pin an exhibition to this artist's ArtistProfile.id directly,
        // without a second round-trip. Null until the invited artist has
        // actually created their profile (see @Roles(SELLER) on
        // POST /artist-profiles) — the frontend excludes those from the
        // dropdown rather than offering a selection that can't be saved.
        // `_count.artworks` feeds OrgArtistList.tsx's roster table column —
        // a single query, no per-artist round-trip.
        artistProfile: {
          select: {
            id: true,
            displayName: true,
            _count: { select: { artworks: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addArtist(organizationId: string, email: string) {
    await this.assertExists(organizationId);
    return this.users.setArtistForOrganization(email, organizationId);
  }

  async removeArtist(organizationId: string, userId: string) {
    await this.assertExists(organizationId);
    return this.users.removeFromOrganization(userId, organizationId);
  }

  // ---- SUPERADMIN organization detail page (read-only) --------------------
  // The platform owner's "what's going on in this gallery" view, used to
  // investigate problems: KPI counts, every exhibition, and every artist
  // down to their artworks and the offers those received (buyer included —
  // same visibility the org's own admins have in OffersService
  // .findByOrganization). Everything is scoped by organizationId.

  async getOverview(organizationId: string) {
    const [org, artists] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              admins: { where: { role: UserRole.GALLERY_ADMIN } },
              // Soft-deleted exhibitions still show in the list (flagged),
              // but don't count as the gallery's exhibitions.
              exhibitions: { where: { deletedAt: null } },
            },
          },
        },
      }),
      // A second count: Prisma's _count can't select the same relation
      // (`admins` = every user in the org) twice with different filters.
      this.prisma.user.count({
        where: { organizationId, role: UserRole.SELLER },
      }),
    ]);
    if (!org) throw new NotFoundException('Organization not found');
    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      counts: {
        admins: org._count.admins,
        exhibitions: org._count.exhibitions,
        artists,
      },
    };
  }

  // The three lists below are server-side paginated + searchable through
  // the shared helpers (common/pagination): `containsSearch` builds the
  // case-insensitive OR across the searchable fields, `paginate` runs
  // [items, count] in one transaction and wraps them as Paginated<T>.

  async listExhibitionsForOverview(
    organizationId: string,
    query: OrgExhibitionsQueryDto,
  ) {
    await this.assertExists(organizationId);
    const where: Prisma.ExhibitionWhereInput = {
      organizationId,
      ...(query.status && { status: query.status }),
      ...(query.deleted === 'exclude' && { deletedAt: null }),
      ...(query.deleted === 'only' && { deletedAt: { not: null } }),
      ...containsSearch<Prisma.ExhibitionWhereInput>(query.search, (c) => [
        { title: c },
        { curator: { email: c } },
        { artistProfile: { is: { displayName: c } } },
      ]),
    };
    return paginate(query, (page) =>
      this.prisma.$transaction([
        this.prisma.exhibition.findMany({
          where,
          ...page,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            deletedAt: true,
            curator: { select: { email: true } },
            artistProfile: { select: { displayName: true } },
            _count: {
              select: {
                artworkLinks: true,
                // Same definition as ExhibitionsService.getStatsForOwner's
                // totalVisitors, so both screens show the same number.
                visitEvents: { where: { eventType: 'EXHIBITION_ENTER' } },
              },
            },
          },
        }),
        this.prisma.exhibition.count({ where }),
      ]),
    );
  }

  // Paginated by artist; each artist carries their artworks (every status,
  // archived included — this is for investigating, not a storefront) and
  // each artwork its offers, so expanding rows in the UI needs no refetch.
  async listArtistsForOverview(
    organizationId: string,
    query: OrgArtistsQueryDto,
  ) {
    await this.assertExists(organizationId);
    const where: Prisma.UserWhereInput = {
      organizationId,
      role: UserRole.SELLER,
      ...(query.show === 'no-profile' && { artistProfile: { is: null } }),
      ...(query.show === 'pending-offers' && {
        artistProfile: {
          is: {
            artworks: { some: { offers: { some: { status: 'PENDING' } } } },
          },
        },
      }),
      ...containsSearch<Prisma.UserWhereInput>(query.search, (c) => [
        { email: c },
        { artistProfile: { is: { displayName: c } } },
      ]),
    };
    return paginate(query, (page) =>
      this.prisma.$transaction([
        this.prisma.user.findMany({
          where,
          ...page,
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            email: true,
            createdAt: true,
            artistProfile: {
              select: {
                id: true,
                displayName: true,
                artworks: {
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    priceAmount: true,
                    currency: true,
                    createdAt: true,
                    offers: {
                      orderBy: { createdAt: 'desc' },
                      select: {
                        id: true,
                        amount: true,
                        currency: true,
                        status: true,
                        artistDecision: true,
                        createdAt: true,
                        buyer: { select: { email: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.user.count({ where }),
      ]),
    );
  }

  // Org-wide offers, newest first. Scoped exactly like
  // OffersService.findByOrganization (the artwork's artist's organization).
  // Carries everything needed to follow one offer end to end: commission
  // snapshot, response time and the payment Transaction (provider ref,
  // held/released timestamps).
  async listOffersForOverview(
    organizationId: string,
    query: OrgOffersQueryDto,
  ) {
    await this.assertExists(organizationId);
    const where: Prisma.OfferWhereInput = {
      artwork: { artistProfile: { user: { organizationId } } },
      ...(query.status && { status: query.status }),
      ...(query.decision && {
        artistDecision: query.decision === 'NONE' ? null : query.decision,
      }),
      ...containsSearch<Prisma.OfferWhereInput>(query.search, (c) => [
        { artwork: { title: c } },
        { artwork: { artistDisplayName: c } },
        { artwork: { artistProfile: { displayName: c } } },
        { buyer: { email: c } },
      ]),
    };
    return paginate(query, (page) =>
      this.prisma.$transaction([
        this.prisma.offer.findMany({
          where,
          ...page,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            artistDecision: true,
            commissionAmount: true,
            commissionTaxAmount: true,
            createdAt: true,
            respondedAt: true,
            buyer: { select: { email: true } },
            artwork: {
              select: {
                id: true,
                title: true,
                artistDisplayName: true,
                artistProfile: { select: { displayName: true } },
              },
            },
            transaction: {
              select: {
                status: true,
                provider: true,
                providerRef: true,
                heldAt: true,
                releasedAt: true,
              },
            },
          },
        }),
        this.prisma.offer.count({ where }),
      ]),
    );
  }

  // Shared by any module that needs to notify "the org's admins" (Offers,
  // ArtworkRemovalRequests, ...) — pulled out of OffersService once a second
  // consumer needed the same query, so it doesn't get copy-pasted a third
  // time.
  async getOrgAdminUserIds(organizationId: string | null): Promise<string[]> {
    if (!organizationId) return [];
    const admins = await this.prisma.user.findMany({
      where: { organizationId, role: UserRole.GALLERY_ADMIN },
      select: { id: true },
    });
    return admins.map((a) => a.id);
  }
}
