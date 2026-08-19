import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArtistProfileDto } from './dto/create-artist-profile.dto';

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
}
