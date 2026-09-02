import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

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
    return this.prisma.organization.update({ where: { id }, data: { name: dto.name } });
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
