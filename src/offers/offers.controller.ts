import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
