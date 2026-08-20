import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtworkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';
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
  ) {}

  async create(userId: string, dto: CreateArtworkDto) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    return this.prisma.artwork.create({
      data: { ...dto, artistProfileId: profile.id },
    });
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

  async findOwn(userId: string) {
    const profile = await this.artistProfiles.getOwnOrThrow(userId);
    return this.prisma.artwork.findMany({
      where: { artistProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      // Lets the artist see which exhibition(s) an artwork is currently placed in.
      include: { exhibitionLinks: { include: { exhibition: true } } },
    });
  }

  async findOneForView(id: string) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id },
      include: { artistProfile: true },
    });
    if (!artwork || !PUBLIC_STATUSES.includes(artwork.status)) {
      // Same 404 whether it doesn't exist or is just unpublished (draft/archived) —
      // don't leak which case it is to an unauthenticated caller.
      throw new NotFoundException('Artwork not found');
    }
    return artwork;
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
    await this.assertOwnership(id, userId);
    return this.prisma.artwork.update({
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
