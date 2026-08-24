import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArtistProfileDto } from './dto/create-artist-profile.dto';
import { UpdateArtistProfileDto } from './dto/update-artist-profile.dto';

@Injectable()
export class ArtistProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(userId: string, dto: CreateArtistProfileDto) {
    const existing = await this.prisma.artistProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException(
        'Artist profile already exists for this user',
      );
    }
    return this.prisma.artistProfile.create({
      data: { userId, ...dto },
    });
  }

  async getOwnOrThrow(userId: string) {
    const profile = await this.prisma.artistProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('No artist profile for this user yet');
    }
    return profile;
  }

  findByUserId(userId: string) {
    return this.prisma.artistProfile.findUnique({ where: { userId } });
  }

  // Only bio is updatable — displayName has no editing UI yet (out of this
  // task's scope), and institutionName is intentionally not artist-editable
  // at all (vea-frontend derives/displays it from the inviting
  // organization, not from free text the artist controls).
  async updateBio(userId: string, dto: UpdateArtistProfileDto) {
    await this.getOwnOrThrow(userId);
    return this.prisma.artistProfile.update({
      where: { userId },
      data: { bio: dto.bio },
    });
  }
}
