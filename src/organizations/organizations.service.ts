import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  create(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: { name: dto.name } });
  }

  findAll() {
    return this.prisma.organization.findMany({ orderBy: { createdAt: 'asc' } });
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
      where: { organizationId, role: UserRole.ADMIN },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
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
      where: { organizationId, role: UserRole.ARTIST },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
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
}
