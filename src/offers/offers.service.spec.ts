import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payments/payment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { UsersService } from '../users/users.service';

describe('OffersService', () => {
  const buyerId = 'user-buyer';
  const sellerId = 'user-seller';
  const otherId = 'user-other';
  const orgId = 'org-1';

  const artwork = (
    status = 'LISTED',
    overrides: Record<string, unknown> = {},
  ) => ({
    id: 'artwork-1',
    title: 'Test Artwork',
    currency: 'TRY',
    priceAmount: 100_000,
    maxDiscountPercent: null,
    status,
    artistProfile: { userId: sellerId, user: { organizationId: orgId } },
    ...overrides,
  });

  const offerWithStatus = (
    status: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    id: 'offer-1',
    artworkId: 'artwork-1',
    buyerId,
    amount: 100_000,
    currency: 'TRY',
    status,
    artwork: artwork(),
    ...overrides,
  });

  let prisma: {
    artwork: {
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
    offer: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      findUniqueOrThrow: jest.Mock<Promise<unknown>, [unknown]>;
      findFirst: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
      updateMany: jest.Mock<Promise<unknown>, [unknown]>;
    };
    transaction: {
      create: jest.Mock<Promise<unknown>, [unknown]>;
      findUnique: jest.Mock<Promise<unknown>, [unknown]>;
      update: jest.Mock<Promise<unknown>, [unknown]>;
    };
    user: {
      findMany: jest.Mock<Promise<unknown>, [unknown]>;
      findUniqueOrThrow: jest.Mock<Promise<unknown>, [unknown]>;
    };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let payments: {
    holdFunds: jest.Mock<
      Promise<{ provider: string; providerRef: string }>,
      [string, number, string]
    >;
    releaseFunds: jest.Mock<Promise<void>, [string]>;
  };
  let notifications: {
    create: jest.Mock<Promise<unknown>, [string, string, object]>;
    createForMany: jest.Mock<Promise<unknown>, [string[], string, object]>;
  };
  let service: OffersService;

  beforeEach(() => {
    prisma = {
      artwork: {
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
      offer: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        findUniqueOrThrow: jest.fn<Promise<unknown>, [unknown]>(),
        findFirst: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue(null),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        updateMany: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({}),
      },
      transaction: {
        create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
        findUniqueOrThrow: jest
          .fn<Promise<unknown>, [unknown]>()
          .mockResolvedValue({ id: sellerId, organizationId: orgId }),
      },
      $queryRaw: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn((arg: unknown) => {
        if (typeof arg === 'function')
          return (arg as (tx: unknown) => unknown)(prisma);
        return Promise.resolve(arg);
      }),
    };
    payments = {
      holdFunds: jest
        .fn<
          Promise<{ provider: string; providerRef: string }>,
          [string, number, string]
        >()
        .mockResolvedValue({ provider: 'stub', providerRef: 'stub_offer-1' }),
      releaseFunds: jest
        .fn<Promise<void>, [string]>()
        .mockResolvedValue(undefined),
    };
    notifications = {
      create: jest
        .fn<Promise<unknown>, [string, string, object]>()
        .mockResolvedValue({}),
      createForMany: jest
        .fn<Promise<unknown>, [string[], string, object]>()
        .mockResolvedValue(undefined),
    };
    const organizations = new OrganizationsService(
      prisma as unknown as PrismaService,
      {} as unknown as UsersService,
    );
    service = new OffersService(
      prisma as unknown as PrismaService,
      payments as unknown as PaymentService,
      notifications as unknown as NotificationsService,
      organizations,
    );
  });

  describe('create', () => {
    it('copies currency from the artwork, never trusts a client-supplied one', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork('LISTED'));
      await service.create(buyerId, 'artwork-1', { amount: 50_000 });

      const [args] = prisma.offer.create.mock.calls[0] as [
        { data: { currency: string } },
      ];
      expect(args.data.currency).toBe('TRY');
    });

    it('notifies the artist and their org admins, never the buyer identity', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork('LISTED'));
      prisma.offer.create.mockResolvedValueOnce({
        id: 'offer-1',
        amount: 50_000,
        currency: 'TRY',
      });
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);

      await service.create(buyerId, 'artwork-1', { amount: 50_000 });

      expect(notifications.createForMany).toHaveBeenCalledWith(
        [sellerId, 'admin-1', 'admin-2'],
        'OFFER_CREATED',
        expect.objectContaining({
          artworkId: 'artwork-1',
          amount: 50_000,
        }) as object,
      );
    });

    it('rejects an offer on your own artwork', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork('LISTED'));
      await expect(
        service.create(sellerId, 'artwork-1', { amount: 50_000 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an offer on an artwork that already has an accepted offer', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork('LISTED'));
      prisma.offer.findFirst.mockResolvedValueOnce({
        id: 'offer-existing',
        status: 'ACCEPTED',
      });
      await expect(
        service.create(buyerId, 'artwork-1', { amount: 50_000 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an offer on an artwork the artist has already approved a sale on', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork('LISTED'));
      prisma.offer.findFirst
        .mockResolvedValueOnce(null) // reserved-status check
        .mockResolvedValueOnce({
          id: 'offer-existing',
          artistDecision: 'APPROVED',
        }); // artistDecision check
      await expect(
        service.create(buyerId, 'artwork-1', { amount: 50_000 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an offer below the artwork-set minimum (priceAmount * (1 - maxDiscountPercent/100))', async () => {
      // price 100_000, maxDiscountPercent 40 -> minimum is 60_000
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artwork('LISTED', { maxDiscountPercent: 40 }),
      );
      await expect(
        service.create(buyerId, 'artwork-1', { amount: 59_999 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('accepts an offer exactly at the artwork-set minimum', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(
        artwork('LISTED', { maxDiscountPercent: 40 }),
      );
      await service.create(buyerId, 'artwork-1', { amount: 60_000 });
      expect(prisma.offer.create).toHaveBeenCalled();
    });

    it('allows any offer amount when maxDiscountPercent is not set', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork('LISTED'));
      await service.create(buyerId, 'artwork-1', { amount: 1 });
      expect(prisma.offer.create).toHaveBeenCalled();
    });

    it('404s on a DRAFT/ARCHIVED artwork', async () => {
      prisma.artwork.findUnique.mockResolvedValueOnce(artwork('DRAFT'));
      await expect(
        service.create(buyerId, 'artwork-1', { amount: 50_000 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('accept (concurrency-guarded)', () => {
    it('locks the artwork row, accepts, and cancels other pending offers', async () => {
      prisma.offer.findUnique.mockResolvedValueOnce(offerWithStatus('PENDING'));

      await service.accept('offer-1', sellerId);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'offer-1' },
        data: { status: 'ACCEPTED', respondedAt: expect.any(Date) as Date },
      });
      expect(prisma.offer.updateMany).toHaveBeenCalledWith({
        where: {
          artworkId: 'artwork-1',
          status: 'PENDING',
          id: { not: 'offer-1' },
        },
        data: { status: 'CANCELLED', respondedAt: expect.any(Date) as Date },
      });
    });

    it('rejects accept if another offer on the same artwork is already reserved (post-lock check)', async () => {
      prisma.offer.findUnique.mockResolvedValueOnce(offerWithStatus('PENDING'));
      prisma.offer.findFirst.mockResolvedValueOnce({
        id: 'offer-2',
        status: 'ACCEPTED',
      });

      await expect(service.accept('offer-1', sellerId)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });

    it('rejects a non-seller', async () => {
      prisma.offer.findUnique.mockResolvedValueOnce(offerWithStatus('PENDING'));
      await expect(service.accept('offer-1', otherId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects accepting a non-PENDING offer', async () => {
      prisma.offer.findUnique.mockResolvedValueOnce(
        offerWithStatus('REJECTED'),
      );
      await expect(service.accept('offer-1', sellerId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('pay', () => {
    it('holds funds, snapshots commission, and records a HELD transaction', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('ACCEPTED'),
      );

      await service.pay('offer-1', buyerId);

      expect(payments.holdFunds).toHaveBeenCalledWith(
        'offer-1',
        100_000,
        'TRY',
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          offerId: 'offer-1',
          provider: 'stub',
          providerRef: 'stub_offer-1',
          status: 'HELD',
          heldAt: expect.any(Date) as Date,
        },
      });
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'offer-1' },
        data: {
          status: 'PAYMENT_HELD',
          commissionAmount: 15_000,
          commissionTaxAmount: 3_000,
        },
      });
    });

    it('rejects a non-buyer', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('ACCEPTED'),
      );
      await expect(service.pay('offer-1', otherId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects paying an offer that is not ACCEPTED', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PENDING'),
      );
      await expect(service.pay('offer-1', buyerId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('release', () => {
    it('releases the transaction and marks the artwork SOLD', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('DELIVERED'),
      );
      prisma.transaction.findUnique.mockResolvedValueOnce({
        offerId: 'offer-1',
        providerRef: 'stub_offer-1',
      });

      await service.release('offer-1', sellerId);

      expect(payments.releaseFunds).toHaveBeenCalledWith('stub_offer-1');
      expect(prisma.artwork.update).toHaveBeenCalledWith({
        where: { id: 'artwork-1' },
        data: { status: 'SOLD' },
      });
      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'offer-1' },
        data: { status: 'RELEASED' },
      });
    });

    it('rejects releasing an offer that has not been marked DELIVERED', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PAYMENT_HELD'),
      );
      await expect(service.release('offer-1', sellerId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOneForParticipant', () => {
    it('404s for someone who is neither buyer nor seller', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PENDING'),
      );
      await expect(
        service.findOneForParticipant('offer-1', otherId),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows the buyer to view it', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PENDING'),
      );
      await expect(
        service.findOneForParticipant('offer-1', buyerId),
      ).resolves.toBeDefined();
    });

    it('allows the seller to view it', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PENDING'),
      );
      await expect(
        service.findOneForParticipant('offer-1', sellerId),
      ).resolves.toBeDefined();
    });
  });

  describe('setArtistDecision', () => {
    it('records the decision and notifies the buyer + org admins', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PENDING'),
      );
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'admin-1' }]);

      await service.setArtistDecision('offer-1', sellerId, 'APPROVED');

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'offer-1' },
        data: { artistDecision: 'APPROVED' },
      });
      expect(notifications.createForMany).toHaveBeenCalledWith(
        [buyerId, 'admin-1'],
        'OFFER_DECISION',
        expect.objectContaining({ decision: 'APPROVED' }) as object,
      );
    });

    it('rejects a non-seller', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PENDING'),
      );
      await expect(
        service.setArtistDecision('offer-1', otherId, 'APPROVED'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a second decision on the same offer (one-time, irreversible)', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('PENDING', { artistDecision: 'REJECTED' }),
      );
      await expect(
        service.setArtistDecision('offer-1', sellerId, 'APPROVED'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a decision once the offer is no longer PENDING', async () => {
      prisma.offer.findUniqueOrThrow.mockResolvedValueOnce(
        offerWithStatus('ACCEPTED'),
      );
      await expect(
        service.setArtistDecision('offer-1', sellerId, 'APPROVED'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByOrganization', () => {
    it('queries offers scoped to the organization', async () => {
      await service.findByOrganization(orgId);
      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            artwork: { artistProfile: { user: { organizationId: orgId } } },
          },
        }) as object,
      );
    });
  });
});
