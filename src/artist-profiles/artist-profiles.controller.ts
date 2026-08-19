import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ArtistProfilesService } from './artist-profiles.service';
import { CreateArtistProfileDto } from './dto/create-artist-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('artist-profiles')
@UseGuards(JwtAuthGuard)
export class ArtistProfilesController {
  constructor(private readonly artistProfiles: ArtistProfilesService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateArtistProfileDto) {
    return this.artistProfiles.createForUser(user.sub, dto);
  }

  @Get('me')
  getOwn(@CurrentUser() user: JwtPayload) {
    return this.artistProfiles.getOwnOrThrow(user.sub);
  }
}
