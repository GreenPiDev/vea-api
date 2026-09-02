import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtistDecision, OfferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payments/payment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { calculateCommission } from './commission';

// Event types this service pushes through NotificationsService — plain
// strings (see Notification model's comment for why), collected here so
// they're not duplicated across the create()/setArtistDecision() call sites.
const NOTIFICATION_TYPES = {
  OfferCreated: 'OFFER_CREATED',
  OfferDecision: 'OFFER_DECISION',
} as const;

// Forward-only, matching the flow from the meeting notes:
// Teklif -> Kabul -> Ödeme/bloke -> Teslimat -> Blokenin kaldırılması.
const ALLOWED_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PAYMENT_HELD'],
  PAYMENT_HELD: ['DELIVERED'],
  DELIVERED: ['RELEASED'],
  REJECTED: [],
  CANCELLED: [],
  RELEASED: [],
};

// An offer on this artwork has moved past open negotiation — no new offers,
// and no other PENDING offer on the same artwork can still be accepted.
const RESERVING_STATUSES: OfferStatus[] = [
  'ACCEPTED',
  'PAYMENT_HELD',
  'DELIVERED',
  'RELEASED',
];

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly notifications: NotificationsService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(buyerId: string, artworkId: string, dto: CreateOfferDto) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { artistProfile: { include: { user: true } } },
    });
    if (!artwork || !['LISTED', 'IN_EXHIBITION'].includes(artwork.status)) {
      throw new NotFoundException('Artwork not found');
    }
    if (artwork.artistProfile.userId === buyerId) {
      throw new ForbiddenException(
        'You cannot make an offer on your own artwork',
      );
    }

    const reserved = await this.prisma.offer.findFirst({
      where: { artworkId, status: { in: RESERVING_STATUSES } },
    });
    if (reserved) {
      throw new ConflictException(
        'This artwork already has an accepted offer in progress',
      );
    }

    // artistDecision is informal and separate from the real status machine
    // above (see Offer.artistDecision's comment), but once the artist has
    // recorded APPROVED on some offer for this artwork, product intent is
    // that it's sold in practice — no further offers should be possible,
    // even though the real Offer/Artwork.status transitions haven't run.
    const approvedDecision = await this.prisma.offer.findFirst({
      where: { artworkId, artistDecision: 'APPROVED' },
    });
    if (approvedDecision) {
      throw new ConflictException('This artwork has already been sold');
    }

    if (artwork.maxDiscountPercent != null) {
      const minAmount = Math.ceil(
        artwork.priceAmount * (1 - artwork.maxDiscountPercent / 100),
      );
      if (dto.amount < minAmount) {
        throw new BadRequestException(
          `Offer must be at least ${minAmount} ${artwork.currency}`,
        );
      }
    }

    const offer = await this.prisma.offer.create({
      data: {
        artworkId,
        buyerId,
        amount: dto.amount,
        currency: artwork.currency,
      },
    });

    const recipients = [
      artwork.artistProfile.userId,
      ...(await this.organizations.getOrgAdminUserIds(
        artwork.artistProfile.user.organizationId,
      )),
    ];
    await this.notifications.createForMany(
      recipients,
      NOTIFICATION_TYPES.OfferCreated,
      {
        offerId: offer.id,
        artworkId: artwork.id,
        artworkTitle: artwork.title,
        amount: offer.amount,
        currency: offer.currency,
      },
    );

    return offer;
  }

  findMineAsBuyer(userId: string) {
    return this.prisma.offer.findMany({
      where: { buyerId: userId },
      include: { artwork: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findMineAsSeller(userId: string) {
    return this.prisma.offer.findMany({
      where: { artwork: { artistProfile: { userId } } },
      // exhibitionLinks so the UI can show which show the artwork is
      // currently hanging in, same "sergileniyor: X" info ArtworkList.tsx
      // already surfaces elsewhere.
      include: {
        artwork: {
          include: { exhibitionLinks: { include: { exhibition: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin's org-wide view — unlike findMineAsSeller (one artist's own
  // offers, no buyer identity) this includes every offer on any artwork by
  // any artist in the admin's organization, buyer included. An ADMIN is
  // the gallery's business side and needs full visibility to act on sales;
  // an ARTIST only sees their own artwork's offers (see setArtistDecision's
  // comment on why buyer identity is withheld from them).
  findByOrganization(organizationId: string) {
    return this.prisma.offer.findMany({
      where: { artwork: { artistProfile: { user: { organizationId } } } },
      include: {
        artwork: {
          include: {
            artistProfile: true,
            exhibitionLinks: { include: { exhibition: true } },
          },
        },
        buyer: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Informal, non-binding signal — deliberately NOT part of the real
  // status state machine below (assertTransition/ALLOWED_TRANSITIONS) and
  // never touches PaymentService. One-time and irreversible per product
  // decision: an artist can register their preference once, it locks.
  async setArtistDecision(
    id: string,
    userId: string,
    decision: ArtistDecision,
  ) {
    const offer = await this.assertSeller(id, userId);
    if (offer.artistDecision) {
      throw new ConflictException(
        'A decision has already been recorded for this offer',
      );
    }
    if (offer.status !== 'PENDING') {
      throw new ConflictException('This offer is no longer pending');
    }

    const updated = await this.prisma.offer.update({
      where: { id },
      data: { artistDecision: decision },
    });

    const artistUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: offer.artwork.artistProfile.userId },
    });
    const recipients = [
      offer.buyerId,
      ...(await this.organizations.getOrgAdminUserIds(
        artistUser.organizationId,
      )),
    ];
    await this.notifications.createForMany(
      recipients,
      NOTIFICATION_TYPES.OfferDecision,
      {
        offerId: offer.id,
        artworkId: offer.artworkId,
        artworkTitle: offer.artwork.title,
        decision,
      },
    );

    return updated;
  }

  async findOneForParticipant(id: string, userId: string) {
    const offer = await this.getWithParticipants(id);
    if (
      offer.buyerId !== userId &&
      offer.artwork.artistProfile.userId !== userId
    ) {
      // Same 404 for "doesn't exist" and "exists but you're not a party to
      // it" — don't leak which case it is to an unrelated caller.
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  async reject(id: string, userId: string) {
    const offer = await this.assertSeller(id, userId);
    this.assertTransition(offer.status, 'REJECTED');
    return this.prisma.offer.update({
      where: { id },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });
  }

  async cancel(id: string, userId: string) {
    const offer = await this.assertBuyer(id, userId);
    this.assertTransition(offer.status, 'CANCELLED');
    return this.prisma.offer.update({
      where: { id },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
  }

  async accept(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({
        where: { id },
        include: { artwork: { include: { artistProfile: true } } },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      if (offer.artwork.artistProfile.userId !== userId) {
        throw new ForbiddenException(
          'You do not own the artwork this offer is for',
        );
      }
      this.assertTransition(offer.status, 'ACCEPTED');

      // Row-lock the artwork so a concurrent accept() on a different pending
      // offer for the SAME artwork has to wait for this transaction to
      // commit, then sees the ACCEPTED offer below and is correctly rejected
      // instead of racing to a double-sell.
      await tx.$queryRaw`SELECT id FROM "Artwork" WHERE id = ${offer.artworkId} FOR UPDATE`;

      const alreadyReserved = await tx.offer.findFirst({
        where: {
          artworkId: offer.artworkId,
          status: { in: RESERVING_STATUSES },
        },
      });
      if (alreadyReserved) {
        throw new ConflictException(
          'Another offer on this artwork was already accepted',
        );
      }

      const accepted = await tx.offer.update({
        where: { id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      // Every other still-open offer on this artwork is now moot.
      await tx.offer.updateMany({
        where: {
          artworkId: offer.artworkId,
          status: 'PENDING',
          id: { not: id },
        },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });

      return accepted;
    });
  }

  async pay(id: string, userId: string) {
    const offer = await this.assertBuyer(id, userId);
    this.assertTransition(offer.status, 'PAYMENT_HELD');

    const { commissionAmount, commissionTaxAmount } = calculateCommission(
      offer.amount,
    );
    const held = await this.payments.holdFunds(
      offer.id,
      offer.amount,
      offer.currency,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          offerId: offer.id,
          provider: held.provider,
          providerRef: held.providerRef,
          status: 'HELD',
          heldAt: new Date(),
        },
      });
      return tx.offer.update({
        where: { id },
        data: { status: 'PAYMENT_HELD', commissionAmount, commissionTaxAmount },
      });
    });
  }

  async markDelivered(id: string, userId: string) {
    const offer = await this.assertSeller(id, userId);
    this.assertTransition(offer.status, 'DELIVERED');
    return this.prisma.offer.update({
      where: { id },
      data: { status: 'DELIVERED' },
    });
  }

  async release(id: string, userId: string) {
    const offer = await this.assertSeller(id, userId);
    this.assertTransition(offer.status, 'RELEASED');

    const transaction = await this.prisma.transaction.findUnique({
      where: { offerId: id },
    });
    if (!transaction)
      throw new ConflictException('No held transaction found for this offer');
    if (transaction.providerRef) {
      await this.payments.releaseFunds(transaction.providerRef);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { offerId: id },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });
      await tx.artwork.update({
        where: { id: offer.artworkId },
        data: { status: 'SOLD' },
      });
      return tx.offer.update({ where: { id }, data: { status: 'RELEASED' } });
    });
  }

  private assertTransition(current: OfferStatus, next: OfferStatus) {
    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new ConflictException(
        `Cannot move offer from ${current} to ${next}`,
      );
    }
  }

  private getWithParticipants(id: string) {
    return this.prisma.offer
      .findUniqueOrThrow({
        where: { id },
        include: { artwork: { include: { artistProfile: true } } },
      })
      .catch(() => {
        throw new NotFoundException('Offer not found');
      });
  }

  private async assertBuyer(id: string, userId: string) {
    const offer = await this.getWithParticipants(id);
    if (offer.buyerId !== userId) {
      throw new ForbiddenException('You are not the buyer on this offer');
    }
    return offer;
  }

  private async assertSeller(id: string, userId: string) {
    const offer = await this.getWithParticipants(id);
    if (offer.artwork.artistProfile.userId !== userId) {
      throw new ForbiddenException(
        'You do not own the artwork this offer is for',
      );
    }
    return offer;
  }
}
