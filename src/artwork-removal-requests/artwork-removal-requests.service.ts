import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ExhibitionsService } from '../exhibitions/exhibitions.service';
import { ArtworksService } from '../artworks/artworks.service';
import { CreateRemovalRequestDto } from './dto/create-removal-request.dto';
import type { RemovalDecision } from './dto/decide-removal-request.dto';

// Event types this service pushes through NotificationsService — same
// "collected here, not duplicated at each call site" pattern as
// OffersService's NOTIFICATION_TYPES.
const NOTIFICATION_TYPES = {
  RemovalRequested: 'ARTWORK_REMOVAL_REQUESTED',
  RemovalDecided: 'ARTWORK_REMOVAL_DECIDED',
} as const;

@Injectable()
export class ArtworkRemovalRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly organizations: OrganizationsService,
    private readonly exhibitions: ExhibitionsService,
    private readonly artworks: ArtworksService,
  ) {}

  async create(userId: string, dto: CreateRemovalRequestDto) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: dto.artworkId },
      include: { artistProfile: true },
    });
    if (!artwork) throw new NotFoundException('Artwork not found');
    if (artwork.artistProfile.userId !== userId) {
      throw new ForbiddenException('You do not own this artwork');
    }

    const link = await this.prisma.exhibitionArtwork.findUnique({
      where: {
        exhibitionId_artworkId: {
          exhibitionId: dto.exhibitionId,
          artworkId: dto.artworkId,
        },
      },
      include: { exhibition: true },
    });
    if (!link) {
      throw new NotFoundException('Artwork is not placed in this exhibition');
    }

    const existingPending = await this.prisma.artworkRemovalRequest.findFirst({
      where: {
        artworkId: dto.artworkId,
        exhibitionId: dto.exhibitionId,
        status: 'PENDING',
      },
    });
    if (existingPending) {
      throw new ConflictException(
        'Bu eser için zaten bekleyen bir kaldırma talebi var',
      );
    }

    const request = await this.prisma.artworkRemovalRequest.create({
      data: {
        artworkId: dto.artworkId,
        exhibitionId: dto.exhibitionId,
        requestedById: userId,
        message: dto.message,
      },
    });

    const recipients = await this.organizations.getOrgAdminUserIds(
      link.exhibition.organizationId,
    );
    await this.notifications.createForMany(
      recipients,
      NOTIFICATION_TYPES.RemovalRequested,
      {
        requestId: request.id,
        artworkId: artwork.id,
        artworkTitle: artwork.title,
        exhibitionId: link.exhibition.id,
        exhibitionTitle: link.exhibition.title,
        message: dto.message,
      },
    );

    return request;
  }

  findByOrganization(organizationId: string) {
    return this.prisma.artworkRemovalRequest.findMany({
      where: { exhibition: { organizationId } },
      include: {
        artwork: true,
        exhibition: true,
        requestedBy: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async decide(
    id: string,
    adminUserId: string,
    organizationId: string | null,
    decision: RemovalDecision,
    responseMessage: string,
  ) {
    const request = await this.prisma.artworkRemovalRequest.findUnique({
      where: { id },
      include: { artwork: true, exhibition: true },
    });
    if (!request) throw new NotFoundException('Removal request not found');
    if (
      !organizationId ||
      request.exhibition.organizationId !== organizationId
    ) {
      throw new ForbiddenException(
        'This removal request does not belong to your organization',
      );
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('This removal request was already decided');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.artworkRemovalRequest.update({
        where: { id },
        data: {
          status: decision,
          responseMessage,
          decidedById: adminUserId,
          respondedAt: new Date(),
        },
      });

      if (decision === 'APPROVED') {
        await this.exhibitions.removeArtworkLink(
          tx,
          request.exhibition,
          request.artworkId,
        );
        await this.artworks.archiveForRemoval(request.artworkId, tx);
      }
    });

    await this.notifications.create(
      request.requestedById,
      NOTIFICATION_TYPES.RemovalDecided,
      {
        requestId: request.id,
        artworkId: request.artworkId,
        artworkTitle: request.artwork.title,
        exhibitionId: request.exhibitionId,
        exhibitionTitle: request.exhibition.title,
        decision,
        responseMessage,
      },
    );

    return this.prisma.artworkRemovalRequest.findUniqueOrThrow({
      where: { id },
    });
  }
}
