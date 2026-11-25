import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

describe('OrganizationsService — SUPERADMIN organization detail', () => {
  const orgId = 'org-1';
  const org = { id: orgId, name: 'VEA Demo Galeri', createdAt: new Date() };

  let prisma: {
    organization: { findUnique: jest.Mock<Promise<unknown>, [unknown]> };
    user: {
      count: jest.Mock<Promise<number>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    };
    exhibition: {
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      count: jest.Mock<Promise<number>, [unknown]>;
    };
    offer: {
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      count: jest.Mock<Promise<number>, [unknown]>;
    };
    $transaction: jest.Mock<Promise<unknown[]>, [Promise<unknown>[]]>;
  };
  const page = { page: 2, pageSize: 10 };

  // The `where` a list method passed to findMany (count gets the same one).
  const whereOf = (mock: jest.Mock<Promise<unknown>, [unknown]>) =>
    (mock.mock.calls[0][0] as { where: Record<string, unknown> }).where;
  let service: OrganizationsService;

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
      user: {
        count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
      },
      exhibition: {
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
      },
      offer: {
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
      },
      $transaction: jest
        .fn<Promise<unknown[]>, [Promise<unknown>[]]>()
        .mockImplementation((ops) => Promise.all(ops)),
    };
    service = new OrganizationsService(
      prisma as unknown as PrismaService,
      {} as UsersService,
    );
  });

  describe('getOverview', () => {
    it('returns the three KPI counts', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({
        ...org,
        _count: { admins: 3, exhibitions: 5 },
      });
      prisma.user.count.mockResolvedValueOnce(7);

      await expect(service.getOverview(orgId)).resolves.toEqual({
        ...org,
        counts: { admins: 3, exhibitions: 5, artists: 7 },
      });
    });

    it('counts only sellers of this organization as artists', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({
        ...org,
        _count: { admins: 0, exhibitions: 0 },
      });

      await service.getOverview(orgId);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { organizationId: orgId, role: 'SELLER' },
      });
    });

    it('does not count soft-deleted exhibitions', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({
        ...org,
        _count: { admins: 0, exhibitions: 0 },
      });

      await service.getOverview(orgId);

      const [args] = prisma.organization.findUnique.mock.calls[0] as [
        { select: { _count: { select: { exhibitions: unknown } } } },
      ];
      expect(args.select._count.select.exhibitions).toEqual({
        where: { deletedAt: null },
      });
    });

    it('404s for an unknown organization', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(service.getOverview('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listExhibitionsForOverview', () => {
    beforeEach(() => prisma.organization.findUnique.mockResolvedValue(org));

    it('is scoped to the organization and returns a page with the total', async () => {
      prisma.exhibition.findMany.mockResolvedValueOnce([{ id: 'e1' }]);
      prisma.exhibition.count.mockResolvedValueOnce(31);

      await expect(
        service.listExhibitionsForOverview(orgId, { ...page }),
      ).resolves.toEqual({ items: [{ id: 'e1' }], total: 31, ...page });

      expect(whereOf(prisma.exhibition.findMany)).toEqual({
        organizationId: orgId,
      });
      const [args] = prisma.exhibition.findMany.mock.calls[0] as [
        { skip: number; take: number },
      ];
      expect([args.skip, args.take]).toEqual([10, 10]);
    });

    it('applies status, deleted and search filters; count uses the same where', async () => {
      await service.listExhibitionsForOverview(orgId, {
        ...page,
        status: 'ACTIVE',
        deleted: 'only',
        search: 'yaz',
      });

      const c = { contains: 'yaz', mode: 'insensitive' };
      const where = whereOf(prisma.exhibition.findMany);
      expect(where).toEqual({
        organizationId: orgId,
        status: 'ACTIVE',
        deletedAt: { not: null },
        OR: [
          { title: c },
          { curator: { email: c } },
          { artistProfile: { is: { displayName: c } } },
        ],
      });
      expect(prisma.exhibition.count).toHaveBeenCalledWith({ where });
    });

    it("deleted: 'exclude' hides soft-deleted exhibitions", async () => {
      await service.listExhibitionsForOverview(orgId, {
        ...page,
        deleted: 'exclude',
      });
      expect(whereOf(prisma.exhibition.findMany)).toMatchObject({
        deletedAt: null,
      });
    });

    it('404s for an unknown organization without querying exhibitions', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.listExhibitionsForOverview('nope', { ...page }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.exhibition.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listArtistsForOverview', () => {
    beforeEach(() => prisma.organization.findUnique.mockResolvedValue(org));

    it("lists only this organization's sellers, searchable by email or name", async () => {
      await service.listArtistsForOverview(orgId, { ...page, search: 'ali' });

      const c = { contains: 'ali', mode: 'insensitive' };
      expect(whereOf(prisma.user.findMany)).toEqual({
        organizationId: orgId,
        role: 'SELLER',
        OR: [{ email: c }, { artistProfile: { is: { displayName: c } } }],
      });
    });

    it("show: 'pending-offers' keeps artists with at least one PENDING offer", async () => {
      await service.listArtistsForOverview(orgId, {
        ...page,
        show: 'pending-offers',
      });
      expect(whereOf(prisma.user.findMany)).toMatchObject({
        artistProfile: {
          is: {
            artworks: { some: { offers: { some: { status: 'PENDING' } } } },
          },
        },
      });
    });

    it("show: 'no-profile' keeps invited artists who haven't created a profile", async () => {
      await service.listArtistsForOverview(orgId, {
        ...page,
        show: 'no-profile',
      });
      expect(whereOf(prisma.user.findMany)).toMatchObject({
        artistProfile: { is: null },
      });
    });

    it('404s for an unknown organization', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.listArtistsForOverview('nope', { ...page }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listOffersForOverview', () => {
    beforeEach(() => prisma.organization.findUnique.mockResolvedValue(org));

    it("is scoped like OffersService.findByOrganization (the artwork's artist's org)", async () => {
      await service.listOffersForOverview(orgId, { ...page });
      expect(whereOf(prisma.offer.findMany)).toEqual({
        artwork: { artistProfile: { user: { organizationId: orgId } } },
      });
    });

    it('filters by status and artist decision, searches artwork/artist/buyer', async () => {
      await service.listOffersForOverview(orgId, {
        ...page,
        status: 'PENDING',
        decision: 'APPROVED',
        search: 'gece',
      });

      const c = { contains: 'gece', mode: 'insensitive' };
      const where = whereOf(prisma.offer.findMany);
      expect(where).toEqual({
        artwork: { artistProfile: { user: { organizationId: orgId } } },
        status: 'PENDING',
        artistDecision: 'APPROVED',
        OR: [
          { artwork: { title: c } },
          { artwork: { artistDisplayName: c } },
          { artwork: { artistProfile: { displayName: c } } },
          { buyer: { email: c } },
        ],
      });
      expect(prisma.offer.count).toHaveBeenCalledWith({ where });
    });

    it("decision: 'NONE' means the artist hasn't decided yet", async () => {
      await service.listOffersForOverview(orgId, { ...page, decision: 'NONE' });
      expect(whereOf(prisma.offer.findMany)).toMatchObject({
        artistDecision: null,
      });
    });

    it('404s for an unknown organization', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.listOffersForOverview('nope', { ...page }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.offer.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getArtistDetail', () => {
    it('scopes the lookup to a seller of the caller organization', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'u-1' });

      await expect(service.getArtistDetail(orgId, 'u-1')).resolves.toEqual({
        id: 'u-1',
      });
      expect(whereOf(prisma.user.findFirst)).toEqual({
        id: 'u-1',
        organizationId: orgId,
        role: 'SELLER',
      });
    });

    it('404s for an artist outside the organization (or a non-artist)', async () => {
      await expect(
        service.getArtistDetail(orgId, 'other-org-user'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
