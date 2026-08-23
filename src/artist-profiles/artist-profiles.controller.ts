import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ArtistProfilesService } from './artist-profiles.service';
import { CreateArtistProfileDto } from './dto/create-artist-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('artist-profiles')
@UseGuards(JwtAuthGuard)
export class ArtistProfilesController {
  constructor(private readonly artistProfiles: ArtistProfilesService) {}

  // ARTIST-only, not self-serve — a user only gets this role via a
  // curator's invite (OrganizationsService.addArtist), so by the time
  // this is reachable the user is already provisioned into an org.
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ARTIST)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateArtistProfileDto) {
    return this.artistProfiles.createForUser(user.sub, dto);
  }

  @Get('me')
  getOwn(@CurrentUser() user: JwtPayload) {
    return this.artistProfiles.getOwnOrThrow(user.sub);
  }
}
