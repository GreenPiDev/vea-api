import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExhibitionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';
import { CreateExhibitionDto } from './dto/create-exhibition.dto';
import { UpdateExhibitionDto } from './dto/update-exhibition.dto';
import { AddArtworkToExhibitionDto } from './dto/add-artwork-to-exhibition.dto';
import { UpdateExhibitionArtworkDto } from './dto/update-exhibition-artwork.dto';

const PUBLIC_STATUSES: ExhibitionStatus[] = ['ACTIVE', 'ENDED'];
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// Forward-only state machine: DRAFT -> ACTIVE -> ENDED. ENDED is terminal.
const ALLOWED_TRANSITIONS: Record<ExhibitionStatus, ExhibitionStatus[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['ENDED'],
  ENDED: [],
};

@Injectable()
export class ExhibitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artistProfiles: ArtistProfilesService,
  ) {}

  async create(userId: string, dto: CreateExhibitionDto) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }
    return this.prisma.exhibition.create({
      data: {
        ownerProfileId: profile.id,
        title: dto.title,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        sceneConfig: dto.sceneConfig as unknown as Prisma.InputJsonValue,
      },
    });
  }

  findPublic(take = DEFAULT_PAGE_SIZE, skip = 0) {
    return this.prisma.exhibition.findMany({
      where: { status: { in: PUBLIC_STATUSES } },
      take: Math.min(take, MAX_PAGE_SIZE),
      skip,
      orderBy: { startDate: 'desc' },
    });
  }

  async findOwn(userId: string) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    return this.prisma.exhibition.findMany({
      where: { ownerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Owner-only full detail (any status, including DRAFT — findOneForView
   * rejects DRAFT even for the owner, since it's the public-facing read
   * path). Needed so an artist can place artworks on a wall before ever
   * publishing, instead of the exhibition having to go live empty first.
   */
  async findOneOwn(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.exhibition.findUnique({
      where: { id },
      include: {
        artworkLinks: { include: { artwork: { include: { artistProfile: true } } } },
      },
    });
  }

  async findOneForView(id: string) {
    const exhibition = await this.prisma.exhibition.findUnique({
      where: { id },
      // artistProfile is included so the 3D scene can render a wall label
      // (artist display name) without a second round-trip per artwork.
      include: {
        artworkLinks: { include: { artwork: { include: { artistProfile: true } } } },
      },
    });
    if (!exhibition || !PUBLIC_STATUSES.includes(exhibition.status)) {
      throw new NotFoundException('Exhibition not found');
    }
    return exhibition;
  }

  async update(id: string, userId: string, dto: UpdateExhibitionDto) {
    await this.assertOwnership(id, userId);
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
        sceneConfig: dto.sceneConfig as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async setStatus(id: string, userId: string, status: ExhibitionStatus) {
    const exhibition = await this.assertOwnership(id, userId);
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
      } else if (status === 'ENDED') {
        // Reverse: only artworks still IN_EXHIBITION go back to LISTED (a SOLD
        // artwork stays SOLD — the sale flow owns that transition, not this one).
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

  async remove(id: string, userId: string) {
    const exhibition = await this.assertOwnership(id, userId);
    if (exhibition.status !== 'DRAFT') {
      throw new ConflictException(
        'Only a DRAFT exhibition can be deleted; it is a historical record once ACTIVE/ENDED',
      );
    }
    await this.prisma.$transaction([
      this.prisma.exhibitionArtwork.deleteMany({ where: { exhibitionId: id } }),
      this.prisma.exhibition.delete({ where: { id } }),
    ]);
  }

  async addArtwork(
    exhibitionId: string,
    userId: string,
    dto: AddArtworkToExhibitionDto,
  ) {
    await this.assertOwnership(exhibitionId, userId);
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: dto.artworkId },
      include: { artistProfile: true },
    });
    if (!artwork) throw new NotFoundException('Artwork not found');
    if (artwork.artistProfile.userId !== userId) {
      throw new ForbiddenException(
        'You can only place your own artworks into your exhibitions',
      );
    }
    if (artwork.status === 'ARCHIVED' || artwork.status === 'SOLD') {
      throw new ConflictException(
        `Cannot place a ${artwork.status} artwork into an exhibition`,
      );
    }

    const existing = await this.prisma.exhibitionArtwork.findUnique({
      where: {
        exhibitionId_artworkId: { exhibitionId, artworkId: dto.artworkId },
      },
    });
    if (existing)
      throw new ConflictException(
        'Artwork is already placed in this exhibition',
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
    userId: string,
    dto: UpdateExhibitionArtworkDto,
  ) {
    await this.assertOwnership(exhibitionId, userId);
    await this.assertLinkExists(exhibitionId, artworkId);
    return this.prisma.exhibitionArtwork.update({
      where: { exhibitionId_artworkId: { exhibitionId, artworkId } },
      data: {
        positionData: dto.positionData as unknown as Prisma.InputJsonValue,
        order: dto.order,
      },
    });
  }

  async removeArtwork(exhibitionId: string, artworkId: string, userId: string) {
    const exhibition = await this.assertOwnership(exhibitionId, userId);
    await this.assertLinkExists(exhibitionId, artworkId);

    await this.prisma.$transaction(async (tx) => {
      await tx.exhibitionArtwork.delete({
        where: { exhibitionId_artworkId: { exhibitionId, artworkId } },
      });
      if (exhibition.status === 'ACTIVE') {
        await tx.artwork.updateMany({
          where: { id: artworkId, status: 'IN_EXHIBITION' },
          data: { status: 'LISTED' },
        });
      }
    });
  }

  private async assertOwnership(id: string, userId: string) {
    const exhibition = await this.prisma.exhibition.findUnique({
      where: { id },
      include: { ownerProfile: true },
    });
    if (!exhibition) throw new NotFoundException('Exhibition not found');
    if (exhibition.ownerProfile.userId !== userId) {
      throw new ForbiddenException('You do not own this exhibition');
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
