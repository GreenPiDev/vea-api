import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { SetArtistDecisionDto } from './dto/set-artist-decision.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller()
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Post('artworks/:artworkId/offers')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('artworkId') artworkId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offers.create(user.sub, artworkId, dto);
  }

  @Get('offers/mine/buying')
  listMineAsBuyer(@CurrentUser() user: JwtPayload) {
    return this.offers.findMineAsBuyer(user.sub);
  }

  @Get('offers/mine/selling')
  listMineAsSeller(@CurrentUser() user: JwtPayload) {
    return this.offers.findMineAsSeller(user.sub);
  }

  // Must come before 'offers/:id' so "organization" isn't swallowed as an offer id.
  @Get('offers/organization')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listOrganizationOffers(@CurrentUser() user: JwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException('This admin is not assigned to an organization');
    }
    return this.offers.findByOrganization(user.organizationId);
  }

  @Patch('offers/:id/artist-decision')
  setArtistDecision(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetArtistDecisionDto,
  ) {
    return this.offers.setArtistDecision(id, user.sub, dto.decision);
  }

  @Get('offers/:id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.offers.findOneForParticipant(id, user.sub);
  }

  @Patch('offers/:id/accept')
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.offers.accept(id, user.sub);
  }

  @Patch('offers/:id/reject')
  reject(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.offers.reject(id, user.sub);
  }

  @Patch('offers/:id/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.offers.cancel(id, user.sub);
  }

  @Patch('offers/:id/pay')
  pay(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.offers.pay(id, user.sub);
  }

  @Patch('offers/:id/mark-delivered')
  markDelivered(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.offers.markDelivered(id, user.sub);
  }

  @Patch('offers/:id/release')
  release(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.offers.release(id, user.sub);
  }
}
